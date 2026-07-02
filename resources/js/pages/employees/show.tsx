import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CommentBody } from '@/components/comments/comment-body';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import type { JSONContent } from '@tiptap/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useHttp, usePage } from '@inertiajs/react';
import EmployeeDocumentsCard, { type EmployeeDocument } from '@/components/employee-documents/employee-documents-card';
import EmployeeFilesCard from '@/components/employee-files/employee-files-card';
import SendForSigningModal from '@/components/signing/send-for-signing-modal';
import {
    FormFillPane,
    FormResponsePane,
    type FormRequestData,
} from '@/components/form-renderer/form-fill-pane';
import { AlertTriangle, BookOpen, Check, ClipboardList, Clock, EllipsisVertical, Eye, FileIcon, FilePlus2, FileSignature, FileText, FolderOpen, GraduationCap, HandMetal, LinkIcon, Loader2, Mail, MessageSquare, Pencil, Plus, ThumbsDown, ThumbsUp, Trash2, User, UserCheck, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Worktype {
    id: number;
    eh_worktype_id: string;
    name: string;
}

interface ClockEntry {
    id: number;
    clock_in: string;
}

interface IncidentReport {
    id: number;
    report_number: string;
    incident_date: string;
    incident_type: string | null;
    project_name: string | null;
    status: string;
    location?: { external_id: string; name: string } | null;
}

interface Project {
    id: number;
    name: string;
    external_id: string;
    kiosk_id: number;
}

interface JournalAttachment {
    id: number;
    name: string;
    url: string;
    mime_type: string;
    size: number;
}

interface DocumentTemplate {
    id: number;
    name: string;
    placeholders: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] | null;
    body_html: string | null;
}

interface SigningRequestSummary {
    id: number;
    status: string;
    delivery_method: string;
    recipient_name: string;
    recipient_email: string | null;
    document_title: string | null;
    document_html: string | null;
    created_at: string | null;
    updated_at: string | null;
    signed_at: string | null;
    opened_at: string | null;
    viewed_at: string | null;
    expires_at: string | null;
    signer_full_name: string | null;
    document_template: { id: number; name: string } | null;
    sent_by: { id: number; name: string } | null;
    internal_signer: { id: number; name: string } | null;
    signing_url?: string | null;
}

interface JournalEntry {
    id: number;
    body: string;
    body_json: JSONContent | null;
    type: 'positive' | 'negative' | null;
    user: { id: number; name: string } | null;
    created_at: string;
    mentioned_users?: {
        id: number;
        name: string;
        email?: string | null;
        phone?: string | null;
        position?: string | null;
        roles?: string[];
        is_active?: boolean;
    }[];
    attachments: JournalAttachment[];
}

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    email: string;
    mobile_number?: string | null;
    date_of_birth?: string | null;
    pin: string;
    external_id?: string;
    eh_employee_id?: string;
    employment_type?: string;
    employment_agreement?: string | null;
    employing_entity_id?: number | null;
    employing_entity_name?: string | null;
    start_date?: string | null;
    is_office_staff: boolean;
    display_name: string;
    worktypes?: Worktype[];
    clocks?: ClockEntry[];
    incident_reports?: IncidentReport[];
    created_at: string;
    updated_at: string;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="py-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <div className="mt-1 text-sm">{children || <span className="text-muted-foreground italic">—</span>}</div>
        </div>
    );
}

interface FormTemplateSummary {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    is_sendable: boolean;
    filled_by: 'user' | 'subject';
    assignee_permission: string | null;
}

export default function EmployeeShow() {
    const { employee: emp, projects, weekEnding, journal, canSendDocuments, documents, documentTemplates, signingRequests, availablePlaceholders, savedSenderSignatureUrl, appUsers, formTemplates, formRequests, auth } = usePage<{
        employee: Employee;
        projects: Project[];
        weekEnding: string;
        journal: JournalEntry[];
        canSendDocuments: boolean;
        documents: EmployeeDocument[];
        documentTemplates: DocumentTemplate[];
        signingRequests: SigningRequestSummary[];
        availablePlaceholders: { key: string; label: string; preview?: string }[];
        savedSenderSignatureUrl: string | null;
        appUsers: { id: number; name: string; position: string | null }[];
        formTemplates: FormTemplateSummary[];
        formRequests: FormRequestData[];
        auth: { user?: { id: number; name: string }; permissions?: string[]; isAdmin?: boolean };
    }>().props;

    const permissions = auth?.permissions ?? [];
    const canFillFormRequest = useCallback((fr: FormRequestData): boolean => {
        if (auth?.isAdmin) return true;
        if (fr.assignee_strategy === 'permission' && fr.assignee_permission) {
            return permissions.includes(fr.assignee_permission);
        }
        return permissions.includes('employees.view');
    }, [auth?.isAdmin, permissions]);

    const [showSigningModal, setShowSigningModal] = useState(false);
    const [editingDraft, setEditingDraft] = useState<SigningRequestSummary | null>(null);
    const [confirmDiscardDraftId, setConfirmDiscardDraftId] = useState<number | null>(null);
    const [selectedSigningIds, setSelectedSigningIds] = useState<Set<number>>(new Set());
    const [confirmBulkCancel, setConfirmBulkCancel] = useState(false);
    const [confirmBulkResend, setConfirmBulkResend] = useState(false);
    const [bulkResendChannels, setBulkResendChannels] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false });
    const [resendTarget, setResendTarget] = useState<SigningRequestSummary | null>(null);
    const [resendChannels, setResendChannels] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false });
    const hasMobile = Boolean(emp.mobile_number && emp.mobile_number.trim());

    const openResendDialog = useCallback((sr: SigningRequestSummary) => {
        setResendChannels({ email: true, sms: false });
        setResendTarget(sr);
    }, []);

    const runResend = useCallback(() => {
        if (!resendTarget) return;
        const channels: ('email' | 'sms')[] = [];
        if (resendChannels.email) channels.push('email');
        if (resendChannels.sms) channels.push('sms');
        if (channels.length === 0) return;
        router.post(`/signing-requests/${resendTarget.id}/resend`, { channels }, {
            preserveScroll: true,
            onSuccess: () => setResendTarget(null),
        });
    }, [resendTarget, resendChannels]);

    const toggleSigningSelected = useCallback((id: number) => {
        setSelectedSigningIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Signed/stored PDFs (Documents archive) and active workflow items (Signature Requests).
    // Declared early because allSigningIds + bulk action memos depend on activeSigningRequests.
    const signedDocuments = useMemo(
        () => signingRequests.filter((sr) => sr.status === 'signed' || sr.status === 'delivered'),
        [signingRequests],
    );
    const activeSigningRequests = useMemo(
        () => signingRequests.filter((sr) => sr.status !== 'signed' && sr.status !== 'delivered'),
        [signingRequests],
    );

    const allSigningIds = useMemo(() => activeSigningRequests.map((sr) => sr.id), [activeSigningRequests]);
    const allSelectedOnPage = allSigningIds.length > 0 && allSigningIds.every((id) => selectedSigningIds.has(id));
    const someSelectedOnPage = allSigningIds.some((id) => selectedSigningIds.has(id));

    const toggleSigningSelectAll = useCallback(() => {
        setSelectedSigningIds((prev) => {
            const allSelected = allSigningIds.length > 0 && allSigningIds.every((id) => prev.has(id));
            if (allSelected) return new Set();
            return new Set(allSigningIds);
        });
    }, [allSigningIds]);

    const clearSigningSelection = useCallback(() => setSelectedSigningIds(new Set()), []);

    const selectedSigningRequests = useMemo(
        () => signingRequests.filter((sr) => selectedSigningIds.has(sr.id)),
        [signingRequests, selectedSigningIds],
    );
    const cancellableStatuses = useMemo(() => new Set(['sent', 'opened', 'viewed', 'awaiting_internal_signature']), []);
    // Resendable includes awaiting_internal_signature — the bulk-resend endpoint
    // routes those rows through an internal-signer reminder instead of a recipient resend.
    const resendableStatuses = useMemo(() => new Set(['sent', 'opened', 'viewed', 'awaiting_internal_signature']), []);
    const downloadableStatuses = useMemo(() => new Set(['signed', 'delivered']), []);
    const cancellableSelectedCount = selectedSigningRequests.filter((sr) => cancellableStatuses.has(sr.status)).length;
    const resendableSelectedCount = selectedSigningRequests.filter((sr) => resendableStatuses.has(sr.status)).length;
    const downloadableSelectedCount = selectedSigningRequests.filter((sr) => downloadableStatuses.has(sr.status)).length;

    const runBulkCancel = useCallback(() => {
        const ids = selectedSigningRequests.filter((sr) => cancellableStatuses.has(sr.status)).map((sr) => sr.id);
        if (ids.length === 0) {
            setConfirmBulkCancel(false);
            return;
        }
        router.post('/signing-requests/bulk-cancel', { ids }, {
            preserveScroll: true,
            onSuccess: () => {
                clearSigningSelection();
                setConfirmBulkCancel(false);
            },
        });
    }, [selectedSigningRequests, cancellableStatuses, clearSigningSelection]);

    const runBulkResend = useCallback(() => {
        const ids = selectedSigningRequests.filter((sr) => resendableStatuses.has(sr.status)).map((sr) => sr.id);
        if (ids.length === 0) {
            setConfirmBulkResend(false);
            return;
        }
        const channels: ('email' | 'sms')[] = [];
        if (bulkResendChannels.email) channels.push('email');
        if (bulkResendChannels.sms) channels.push('sms');
        if (channels.length === 0) return;
        router.post('/signing-requests/bulk-resend', { ids, channels }, {
            preserveScroll: true,
            onSuccess: () => {
                clearSigningSelection();
                setConfirmBulkResend(false);
            },
        });
    }, [selectedSigningRequests, resendableStatuses, clearSigningSelection, bulkResendChannels]);

    const runBulkDownload = useCallback(() => {
        const ids = selectedSigningRequests.filter((sr) => downloadableStatuses.has(sr.status)).map((sr) => sr.id);
        if (ids.length === 0) return;
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/signing-requests/bulk-download';
        const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_token';
        csrfInput.value = csrf;
        form.appendChild(csrfInput);
        ids.forEach((id) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'ids[]';
            input.value = String(id);
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }, [selectedSigningRequests, downloadableStatuses]);

    const openSendModal = useCallback(() => {
        setEditingDraft(null);
        setShowSigningModal(true);
    }, []);

    const openDraftModal = useCallback((draft: SigningRequestSummary) => {
        setEditingDraft(draft);
        setShowSigningModal(true);
    }, []);

    const discardDraft = useCallback((id: number) => {
        router.delete(`/signing-requests/${id}/draft`, { preserveScroll: true });
        setConfirmDiscardDraftId(null);
    }, []);

    const currentUserId = auth?.user?.id;

    // Forms tab state
    const [fillingFormRequest, setFillingFormRequest] = useState<FormRequestData | null>(null);
    const [viewingFormRequest, setViewingFormRequest] = useState<FormRequestData | null>(null);
    const [startFormDialogOpen, setStartFormDialogOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [selectedDelivery, setSelectedDelivery] = useState<'in_app' | 'email' | 'sms' | 'in_person'>('in_app');
    const [startingForm, setStartingForm] = useState(false);
    const [confirmCancelFormId, setConfirmCancelFormId] = useState<number | null>(null);

    const selectedTemplate = useMemo(
        () => formTemplates.find((t) => t.id === selectedTemplateId) ?? null,
        [formTemplates, selectedTemplateId],
    );
    const hasMobileForForm = Boolean(emp.mobile_number && emp.mobile_number.replace(/\D/g, '').length >= 9);
    const hasEmail = Boolean(emp.email && emp.email.trim());

    // Auto-open the fill (or response) pane when redirected with
    // ?form_request_id=...&mode=fill|view. Inertia keeps the component
    // mounted on same-route redirects, so the effect must depend on
    // formRequests (the props that change after the POST) rather than
    // running once on mount. After opening, strip the query so a refresh
    // or back-navigation doesn't re-open the pane.
    useEffect(() => {
        if (!formRequests || formRequests.length === 0) return;
        const params = new URLSearchParams(window.location.search);
        const requestedId = Number(params.get('form_request_id'));
        const mode = params.get('mode');
        if (!requestedId) return;
        const target = formRequests.find((fr) => fr.id === requestedId);
        if (!target) return;
        let opened = false;
        if (mode === 'fill' && target.status !== 'submitted' && target.status !== 'cancelled' && canFillFormRequest(target)) {
            setFillingFormRequest(target);
            opened = true;
        } else if (mode === 'view' && target.status === 'submitted') {
            setViewingFormRequest(target);
            opened = true;
        }
        if (opened) {
            const cleaned = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleaned);
        }
    }, [formRequests, canFillFormRequest]);

    const startForm = useCallback(() => {
        if (!selectedTemplateId) return;
        setStartingForm(true);
        router.post(
            `/employees/${emp.id}/forms`,
            { form_template_id: selectedTemplateId, delivery_method: selectedDelivery },
            {
                preserveScroll: false,
                onSuccess: () => {
                    setStartFormDialogOpen(false);
                    setSelectedTemplateId(null);
                    setSelectedDelivery('in_app');
                },
                onFinish: () => setStartingForm(false),
            },
        );
    }, [emp.id, selectedTemplateId, selectedDelivery]);

    // Journal form state
    const [journalDoc, setJournalDoc] = useState<JSONContent | null>(null);
    const [journalType, setJournalType] = useState<string>('positive');
    const [journalFiles, setJournalFiles] = useState<File[]>([]);
    const [journalSubmitting, setJournalSubmitting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const docHasContent = (doc: JSONContent | null) => {
        if (!doc) return false;
        return /"text"|"mention"/.test(JSON.stringify(doc));
    };

    const submitJournal = useCallback(() => {
        if (!docHasContent(journalDoc) && journalFiles.length === 0) return;
        setJournalSubmitting(true);

        const formData = new FormData();
        formData.append('commentable_type', 'employee');
        formData.append('commentable_id', String(emp.id));
        if (journalDoc) formData.append('body_json', JSON.stringify(journalDoc));
        formData.append('type', journalType);
        journalFiles.forEach((file) => formData.append('attachments[]', file));

        router.post('/comments', formData as any, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setJournalDoc(null);
                setJournalType('positive');
                setJournalFiles([]);
            },
            onFinish: () => setJournalSubmitting(false),
        });
    }, [journalDoc, journalType, journalFiles, emp.id]);

    const deleteJournal = useCallback((id: number) => {
        router.delete(`/comments/${id}`, {
            preserveScroll: true,
            onSuccess: () => setConfirmDeleteId(null),
        });
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        emp.is_office_staff
            ? { title: 'Office Employees', href: '/office-employees' }
            : { title: 'Site Employees', href: '/employees' },
        { title: emp.display_name || emp.name, href: `/employees/${emp.id}` },
    ];

    const employmentTypeLabel = emp.employment_type?.replace(/([A-Z])/g, ' $1').trim();

    // Derive unique week-ending dates (Fridays) from recent clocks, excluding current week
    const recentWeekEndings = useMemo(() => {
        if (!emp.clocks || emp.clocks.length === 0) return [];
        const seen = new Set<string>();
        seen.add(weekEnding); // exclude current week
        return emp.clocks
            .map((clock) => {
                const d = new Date(clock.clock_in);
                const day = d.getDay();
                const diff = (5 - day + 7) % 7;
                const friday = new Date(d);
                friday.setDate(d.getDate() + diff);
                const dd = String(friday.getDate()).padStart(2, '0');
                const mm = String(friday.getMonth() + 1).padStart(2, '0');
                const yyyy = friday.getFullYear();
                return `${dd}-${mm}-${yyyy}`;
            })
            .filter((we) => {
                if (seen.has(we)) return false;
                seen.add(we);
                return true;
            });
    }, [emp.clocks, weekEnding]);

    // Location management state
    const [locationDialogOpen, setLocationDialogOpen] = useState(false);
    const [selectedLocationNames, setSelectedLocationNames] = useState<Set<string>>(new Set());
    const [ehLocations, setEhLocations] = useState<{ id: number; name: string; externalId: string | null }[]>([]);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationSuccess, setLocationSuccess] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const httpGetLocations = useHttp({});
    const httpSaveLocations = useHttp({ locations: '' });

    const filteredLocations = useMemo(() => {
        if (!searchQuery) return ehLocations;
        const q = searchQuery.toLowerCase();
        return ehLocations.filter(
            (loc) => loc.name.toLowerCase().includes(q) || loc.externalId?.toLowerCase().includes(q),
        );
    }, [ehLocations, searchQuery]);

    const openLocationDialog = useCallback(() => {
        setLocationDialogOpen(true);
        setLocationError(null);
        setLocationSuccess(null);
        setSearchQuery('');

        httpGetLocations.get(`/employees/${emp.id}/locations`, {
            onSuccess: (data: any) => {
                setEhLocations(data.allEhLocations || []);
                const locationString: string = data.locations || '';
                const names = locationString
                    .split('|')
                    .map((n: string) => n.trim())
                    .filter(Boolean);
                setSelectedLocationNames(new Set(names));
            },
            onError: () => {
                setLocationError('Failed to load current locations');
            },
        });
    }, [emp.id]);

    const toggleLocation = useCallback((locationName: string) => {
        setSelectedLocationNames((prev) => {
            const next = new Set(prev);
            if (next.has(locationName)) {
                next.delete(locationName);
            } else {
                next.add(locationName);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        httpSaveLocations.setData({ locations: Array.from(selectedLocationNames).join('|') });
    }, [selectedLocationNames]);

    const saveLocations = useCallback(() => {
        setLocationError(null);
        setLocationSuccess(null);

        httpSaveLocations.put(`/employees/${emp.id}/locations`, {
            onSuccess: () => {
                setLocationSuccess('Locations updated successfully');
                setTimeout(() => {
                    setLocationDialogOpen(false);
                    router.reload();
                }, 1500);
            },
            onError: () => {
                setLocationError('Failed to update locations');
            },
        });
    }, [emp.id, selectedLocationNames]);

    // Clear success message on dialog close
    useEffect(() => {
        if (!locationDialogOpen) {
            setLocationSuccess(null);
            setLocationError(null);
        }
    }, [locationDialogOpen]);

    // Section nav (master-detail layout)
    const sections = useMemo(() => {
        const all = [
            { id: 'overview', label: 'Overview', icon: User, visible: true, count: undefined as number | undefined },
            { id: 'journal', label: 'Journal', icon: BookOpen, visible: true, count: journal?.length || undefined },
            { id: 'documents', label: 'Documents', icon: FileText, visible: true, count: (documents?.length || 0) + (canSendDocuments ? signedDocuments.length : 0) || undefined },
            { id: 'signing-requests', label: 'Signature Requests', icon: FileSignature, visible: canSendDocuments, count: activeSigningRequests.length || undefined },
            { id: 'forms', label: 'Forms', icon: ClipboardList, visible: true, count: formRequests?.length || undefined },
            { id: 'files', label: 'Licences & Training', icon: GraduationCap, visible: !emp.is_office_staff, count: undefined as number | undefined },
            { id: 'projects', label: 'Projects', icon: FolderOpen, visible: !emp.is_office_staff, count: projects?.length || undefined },
            { id: 'timesheets', label: 'Timesheets', icon: Clock, visible: !emp.is_office_staff, count: undefined as number | undefined },
            { id: 'injuries', label: 'Injury Register', icon: AlertTriangle, visible: !emp.is_office_staff, count: emp.incident_reports?.length || undefined },
        ];
        return all.filter((s) => s.visible);
    }, [emp.is_office_staff, emp.incident_reports, canSendDocuments, journal, documents, signingRequests, signedDocuments, activeSigningRequests, projects, formRequests]);

    const [activeSection, setActiveSection] = useState<string>(() => {
        if (typeof window === 'undefined') return 'overview';
        const hash = window.location.hash.replace('#', '');
        return hash || 'overview';
    });

    // Drop the hash back to overview if the section is hidden (e.g. office staff loading a site-only deep link)
    useEffect(() => {
        if (!sections.some((s) => s.id === activeSection)) {
            setActiveSection('overview');
        }
    }, [sections, activeSection]);

    // Keep URL hash in sync so deep-links and refresh land on the same section
    useEffect(() => {
        const current = window.location.hash.replace('#', '');
        if (current !== activeSection) {
            history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${activeSection}`);
        }
    }, [activeSection]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={emp.display_name || emp.name} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Master-detail layout */}
                <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                    {/* Sidebar rail */}
                    <aside className="shrink-0 lg:w-60">
                        {/* Profile header (desktop only) */}
                        <div className="hidden flex-col items-center gap-2 pb-6 lg:flex">
                            <Avatar className="h-20 w-20">
                                <AvatarFallback className="bg-muted text-muted-foreground text-lg font-semibold">
                                    {getInitials(emp.name || '??')}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <p className="text-sm font-semibold leading-tight">{emp.display_name || emp.name}</p>
                                <p className="mt-0.5 text-muted-foreground text-xs">
                                    {emp.is_office_staff ? 'Office Employee' : 'Site Employee'}
                                </p>
                            </div>
                        </div>

                        {/* Section nav: horizontal scroll on mobile, vertical on desktop */}
                        <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
                            {sections.map((s) => {
                                const Icon = s.icon;
                                const isActive = activeSection === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setActiveSection(s.id)}
                                        className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors lg:shrink ${
                                            isActive
                                                ? 'bg-accent font-medium text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 whitespace-nowrap">{s.label}</span>
                                        {typeof s.count === 'number' && s.count > 0 && (
                                            <Badge variant={isActive ? 'default' : 'secondary'} className="h-4 min-w-4 px-1.5 text-[10px]">
                                                {s.count}
                                            </Badge>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Main pane */}
                    <main className="min-w-0 flex-1">
                        {/* OVERVIEW */}
                        {activeSection === 'overview' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                                            {getInitials(emp.name || '??')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <CardTitle className="text-base">About</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-0 pt-0">
                                <Separator />
                                <DetailItem label="Employee Type">
                                    {employmentTypeLabel ? (
                                        <Badge variant={emp.employment_type === 'FullTime' ? 'default' : emp.employment_type === 'Casual' ? 'outline' : 'secondary'} className="text-xs">
                                            {employmentTypeLabel}
                                        </Badge>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Email Address">
                                    {emp.email ? (
                                        <a href={`mailto:${emp.email}`} className="text-primary hover:underline">
                                            {emp.email}
                                        </a>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Phone Number">
                                    {emp.mobile_number ? (
                                        <a href={`tel:${emp.mobile_number}`} className="text-primary hover:underline">
                                            {emp.mobile_number}
                                        </a>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Date of Birth">
                                    {emp.date_of_birth ? formatDate(emp.date_of_birth) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="External ID">
                                    {emp.external_id?.trim() ? (
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{emp.external_id}</code>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="EH Employee ID">
                                    {emp.eh_employee_id?.trim() ? (
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{emp.eh_employee_id}</code>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Work Types">
                                    {emp.worktypes && emp.worktypes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {emp.worktypes.map((wt) => (
                                                <Badge key={wt.id} variant="secondary" className="text-xs">
                                                    {wt.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : null}
                                </DetailItem>
                            </CardContent>
                        </Card>
                        )}

                        {/* TIMESHEETS */}
                        {activeSection === 'timesheets' && !emp.is_office_staff && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Clock className="h-4 w-4" />
                                        Timesheets
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2 pt-0">
                                    <Separator className="mb-2" />
                                    <Link
                                        href={`/timesheets?employeeId=${emp.eh_employee_id}&weekEnding=${weekEnding}`}
                                        className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                                    >
                                        <LinkIcon className="h-3.5 w-3.5" />
                                        This weeks timesheet
                                    </Link>
                                    {recentWeekEndings.length > 0 &&
                                        recentWeekEndings.map((we) => (
                                            <Link
                                                key={we}
                                                href={`/timesheets?employeeId=${emp.eh_employee_id}&weekEnding=${we}`}
                                                className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                                            >
                                                <LinkIcon className="h-3.5 w-3.5" />
                                                {we}
                                            </Link>
                                        ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* JOURNAL */}
                        {activeSection === 'journal' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <BookOpen className="h-4 w-4" />
                                    Journal
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4 pt-0">
                                <Separator />
                                {/* New entry form */}
                                <div className="flex flex-col gap-2">
                                    <AiRichTextEditor
                                        outputFormat="json"
                                        content={journalDoc}
                                        onChange={setJournalDoc}
                                        placeholder="Add a journal entry. Use @ to mention someone."
                                        enableAttachments
                                        enableMentions
                                        attachments={journalFiles}
                                        onAttachmentsChange={setJournalFiles}
                                    />
                                    <div className="flex items-center gap-2">
                                        <div className="ml-auto flex items-center gap-0">
                                            <div className="inline-flex rounded-md border" role="group">
                                                <button
                                                    type="button"
                                                    onClick={() => setJournalType('positive')}
                                                    className={`inline-flex h-8 items-center gap-1.5 rounded-l-md px-3 text-xs font-medium transition-colors ${
                                                        journalType === 'positive'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                                            : 'bg-background text-muted-foreground hover:bg-accent'
                                                    }`}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5" />
                                                    Positive
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setJournalType('negative')}
                                                    className={`inline-flex h-8 items-center gap-1.5 rounded-r-md border-l px-3 text-xs font-medium transition-colors ${
                                                        journalType === 'negative'
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                                            : 'bg-background text-muted-foreground hover:bg-accent'
                                                    }`}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                    Negative
                                                </button>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-8 ml-2"
                                                onClick={submitJournal}
                                                disabled={journalSubmitting || (!docHasContent(journalDoc) && journalFiles.length === 0)}
                                            >
                                                {journalSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                                Add Entry
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Journal entries */}
                                {journal && journal.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {journal.map((entry) => (
                                            <div key={entry.id} className={`rounded-lg border p-3 ${
                                                entry.type === 'positive'
                                                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                                                    : entry.type === 'negative'
                                                    ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                                                    : ''
                                            }`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        {entry.type === 'positive' ? (
                                                            <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                                        ) : entry.type === 'negative' ? (
                                                            <ThumbsDown className="h-3.5 w-3.5 shrink-0 text-red-600" />
                                                        ) : null}
                                                        <span className="text-xs font-medium">{entry.user?.name ?? 'System'}</span>
                                                        <span className="text-muted-foreground text-xs">{formatDate(entry.created_at)}</span>
                                                    </div>
                                                    {currentUserId === entry.user?.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDeleteId(entry.id)}
                                                            className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                {entry.body_json ? (
                                                    <CommentBody
                                                        doc={entry.body_json}
                                                        mentionedUsers={entry.mentioned_users}
                                                        className="prose prose-sm dark:prose-invert mt-1.5 max-w-none"
                                                    />
                                                ) : entry.body ? (
                                                    <div className="prose prose-sm dark:prose-invert mt-1.5 max-w-none" dangerouslySetInnerHTML={{ __html: entry.body }} />
                                                ) : null}
                                                {entry.attachments && entry.attachments.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {entry.attachments.map((att) =>
                                                            att.mime_type.startsWith('image/') ? (
                                                                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                                                    <img src={att.url} alt={att.name} className="max-h-36 rounded-lg border object-cover" />
                                                                </a>
                                                            ) : (
                                                                <a
                                                                    key={att.id}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="hover:bg-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors"
                                                                >
                                                                    <FileIcon className="h-4 w-4 shrink-0" />
                                                                    <span className="truncate">{att.name}</span>
                                                                </a>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No journal entries yet</p>
                                )}
                            </CardContent>
                        </Card>
                        )}

                        {/* DOCUMENTS — direct uploads + system-generated (signed PDFs) grouped */}
                        {activeSection === 'documents' && (
                            <EmployeeDocumentsCard
                                employeeId={emp.id}
                                documents={documents}
                                signedDocuments={canSendDocuments
                                    ? signedDocuments.map((sr) => ({
                                          id: sr.id,
                                          title: sr.document_template?.name ?? sr.document_title ?? 'Document',
                                          signed_at: sr.signed_at ?? sr.updated_at ?? sr.created_at,
                                          signer_name: sr.signer_full_name ?? sr.recipient_name,
                                          download_url: `/signing-requests/${sr.id}/download`,
                                      }))
                                    : []}
                            />
                        )}

                        {/* SIGNATURE REQUESTS — workflow tracker for outbound signing requests */}
                        {activeSection === 'signing-requests' && canSendDocuments && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <FileSignature className="h-4 w-4" />
                                            Signature Requests
                                        </CardTitle>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="gap-1.5" onClick={openSendModal}>
                                                <FilePlus2 className="h-3.5 w-3.5" />
                                                Send for Signing
                                            </Button>
                                            <Button size="sm" className="gap-1.5" onClick={() => router.visit(route('employees.send', emp.id))}>
                                                <FilePlus2 className="h-3.5 w-3.5" />
                                                Send Docs — New
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <Separator className="mb-4" />
                                    {activeSigningRequests.length === 0 ? (
                                        <p className="text-muted-foreground text-sm italic">
                                            No pending signature requests.
                                            {signedDocuments.length > 0 && ' Signed documents are in the Signed Documents tab.'}
                                        </p>
                                    ) : (
                                        <>
                                            {selectedSigningIds.size > 0 && (
                                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="font-medium">{selectedSigningIds.size} selected</span>
                                                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearSigningSelection}>
                                                            <X className="h-3 w-3" /> Clear
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={downloadableSelectedCount === 0}
                                                            onClick={runBulkDownload}
                                                        >
                                                            Download ({downloadableSelectedCount})
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={resendableSelectedCount === 0}
                                                            onClick={() => {
                                                                setBulkResendChannels({ email: true, sms: false });
                                                                setConfirmBulkResend(true);
                                                            }}
                                                        >
                                                            Resend ({resendableSelectedCount})
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-destructive text-xs"
                                                            disabled={cancellableSelectedCount === 0}
                                                            onClick={() => setConfirmBulkCancel(true)}
                                                        >
                                                            Cancel ({cancellableSelectedCount})
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Desktop table */}
                                            <div className="hidden overflow-hidden rounded-lg border md:block">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-10 px-3">
                                                                <Checkbox
                                                                    aria-label="Select all"
                                                                    checked={allSelectedOnPage}
                                                                    indeterminate={!allSelectedOnPage && someSelectedOnPage}
                                                                    onCheckedChange={() => toggleSigningSelectAll()}
                                                                />
                                                            </TableHead>
                                                            <TableHead className="px-3 text-xs">Document</TableHead>
                                                            <TableHead className="px-3 text-xs">Sent by</TableHead>
                                                            <TableHead className="px-3 text-xs">Status</TableHead>
                                                            <TableHead className="w-12 px-3 text-xs text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activeSigningRequests.map((sr) => {
                                                            const isSigned = sr.status === 'signed';
                                                            const isDraft = sr.status === 'draft';
                                                            const docTitle = sr.document_template?.name ?? sr.document_title ?? 'Document';
                                                            const isAwaitingInternal = sr.status === 'awaiting_internal_signature';
                                                            const isDelivered = sr.status === 'delivered';
                                                            const statusLabel = isDraft ? 'draft' : isDelivered ? 'delivered' : isAwaitingInternal ? 'awaiting signer' : (isSigned ? 'signed' : 'sent');
                                                            const statusTimestamp = isDraft
                                                                ? `saved ${formatDateTime(sr.updated_at ?? sr.created_at)}`
                                                                : isSigned
                                                                    ? (sr.signed_at ? formatDateTime(sr.signed_at) : '')
                                                                    : (sr.created_at ? formatDateTime(sr.created_at) : '');
                                                            const deliveryLabel = isDraft
                                                                ? 'One-off · not yet sent'
                                                                : (sr.delivery_method === 'email' ? 'Via email' : 'In-person');
                                                            const isSent = !isDraft && !isSigned && !isDelivered && !isAwaitingInternal;
                                                            const hasActions = isDraft || isSigned || isDelivered || isSent || isAwaitingInternal;
                                                            return (
                                                                <TableRow key={sr.id} data-state={selectedSigningIds.has(sr.id) ? 'selected' : undefined}>
                                                                    <TableCell className="w-10 px-3">
                                                                        <Checkbox
                                                                            aria-label={`Select ${docTitle}`}
                                                                            checked={selectedSigningIds.has(sr.id)}
                                                                            onCheckedChange={() => toggleSigningSelected(sr.id)}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell className="px-3 text-xs">
                                                                        <p className="font-medium leading-tight">{docTitle}</p>
                                                                        <p className="text-[10px] text-muted-foreground">{deliveryLabel}</p>
                                                                        {isAwaitingInternal && sr.internal_signer && (
                                                                            <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                                                                Waiting on {sr.internal_signer.name}
                                                                            </p>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="px-3 text-xs">{isDraft ? '—' : (sr.sent_by?.name ?? '—')}</TableCell>
                                                                    <TableCell className="px-3 text-xs">
                                                                        <Badge variant={isDraft ? 'outline' : isDelivered ? 'default' : isAwaitingInternal ? 'outline' : (isSigned ? 'default' : 'secondary')} className="mr-1.5 text-[10px] capitalize">{statusLabel}</Badge>
                                                                        <span className="text-muted-foreground">{statusTimestamp}</span>
                                                                    </TableCell>
                                                                    <TableCell className="w-12 px-3 text-right">
                                                                        {hasActions ? (
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" aria-label="Row actions" className="h-7 w-7">
                                                                                        <EllipsisVertical className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end" className="min-w-max">
                                                                                    {isDraft && (
                                                                                        <>
                                                                                            <DropdownMenuItem className="whitespace-nowrap" onClick={() => openDraftModal(sr)}>Edit draft</DropdownMenuItem>
                                                                                            <DropdownMenuSeparator />
                                                                                            <DropdownMenuItem
                                                                                                className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                                                onClick={() => setConfirmDiscardDraftId(sr.id)}
                                                                                            >
                                                                                                Discard draft
                                                                                            </DropdownMenuItem>
                                                                                        </>
                                                                                    )}
                                                                                    {(isSigned || isDelivered) && (
                                                                                        <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                            <a href={`/signing-requests/${sr.id}/download`} target="_blank" rel="noreferrer">Download</a>
                                                                                        </DropdownMenuItem>
                                                                                    )}
                                                                                    {isSent && (
                                                                                        <>
                                                                                            {sr.signing_url && (
                                                                                                <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                                    <a href={sr.signing_url} target="_blank" rel="noreferrer">Sign in person</a>
                                                                                                </DropdownMenuItem>
                                                                                            )}
                                                                                            <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                                <a href={`/signing-requests/${sr.id}/download?preview=1`} target="_blank" rel="noreferrer">Download as sent</a>
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuItem
                                                                                                className="whitespace-nowrap"
                                                                                                onClick={() => openResendDialog(sr)}
                                                                                            >
                                                                                                Resend
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuSeparator />
                                                                                            <DropdownMenuItem
                                                                                                className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                                                onClick={() => router.post(`/signing-requests/${sr.id}/cancel`, {}, { preserveScroll: true })}
                                                                                            >
                                                                                                Cancel
                                                                                            </DropdownMenuItem>
                                                                                        </>
                                                                                    )}
                                                                                    {isAwaitingInternal && (
                                                                                        <>
                                                                                            <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                                <a href={`/signing-requests/${sr.id}/download?preview=1`} target="_blank" rel="noreferrer">Download as sent</a>
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuItem
                                                                                                className="whitespace-nowrap"
                                                                                                onClick={() => router.post(`/signing-requests/${sr.id}/resend`, {}, { preserveScroll: true })}
                                                                                            >
                                                                                                {sr.internal_signer ? `Remind ${sr.internal_signer.name}` : 'Send reminder'}
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuSeparator />
                                                                                            <DropdownMenuItem
                                                                                                className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                                                onClick={() => router.post(`/signing-requests/${sr.id}/cancel`, {}, { preserveScroll: true })}
                                                                                            >
                                                                                                Cancel
                                                                                            </DropdownMenuItem>
                                                                                        </>
                                                                                    )}
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground italic">—</span>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Mobile card layout */}
                                            <div className="flex flex-col gap-2 md:hidden">
                                                {activeSigningRequests.map((sr) => {
                                                    const isSigned = sr.status === 'signed';
                                                    const isDraft = sr.status === 'draft';
                                                    const isAwaitingInternal = sr.status === 'awaiting_internal_signature';
                                                    const isDelivered = sr.status === 'delivered';
                                                    const docTitle = sr.document_template?.name ?? sr.document_title ?? 'Document';
                                                    const statusLabel = isDraft ? 'draft' : isDelivered ? 'delivered' : isAwaitingInternal ? 'awaiting signer' : (isSigned ? 'signed' : 'sent');
                                                    const statusTimestamp = isDraft
                                                        ? `saved ${formatDateTime(sr.updated_at ?? sr.created_at)}`
                                                        : isSigned
                                                            ? (sr.signed_at ? formatDateTime(sr.signed_at) : '')
                                                            : (sr.created_at ? formatDateTime(sr.created_at) : '');
                                                    const isSent = !isDraft && !isSigned && !isDelivered && !isAwaitingInternal;
                                                    const hasActions = isDraft || isSigned || isDelivered || isSent || isAwaitingInternal;
                                                    return (
                                                        <div key={sr.id} className="rounded-md border p-3">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-start gap-2">
                                                                    <Checkbox
                                                                        aria-label={`Select ${docTitle}`}
                                                                        className="mt-0.5"
                                                                        checked={selectedSigningIds.has(sr.id)}
                                                                        onCheckedChange={() => toggleSigningSelected(sr.id)}
                                                                    />
                                                                    <div>
                                                                        <p className="text-sm font-medium">{docTitle}</p>
                                                                        {!isDraft && <p className="text-[10px] text-muted-foreground">by {sr.sent_by?.name ?? '—'}</p>}
                                                                        {isAwaitingInternal && sr.internal_signer && (
                                                                            <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                                                                Waiting on {sr.internal_signer.name}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Badge variant={isDraft ? 'outline' : isDelivered ? 'default' : isAwaitingInternal ? 'outline' : (isSigned ? 'default' : 'secondary')} className="shrink-0 text-[10px] capitalize">{statusLabel}</Badge>
                                                                    {hasActions && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" aria-label="Row actions" className="h-7 w-7">
                                                                                    <EllipsisVertical className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className="min-w-max">
                                                                                {isDraft && (
                                                                                    <>
                                                                                        <DropdownMenuItem className="whitespace-nowrap" onClick={() => openDraftModal(sr)}>Edit draft</DropdownMenuItem>
                                                                                        <DropdownMenuSeparator />
                                                                                        <DropdownMenuItem
                                                                                            className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                                            onClick={() => setConfirmDiscardDraftId(sr.id)}
                                                                                        >
                                                                                            Discard draft
                                                                                        </DropdownMenuItem>
                                                                                    </>
                                                                                )}
                                                                                {(isSigned || isDelivered) && (
                                                                                    <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                        <a href={`/signing-requests/${sr.id}/download`} target="_blank" rel="noreferrer">Download</a>
                                                                                    </DropdownMenuItem>
                                                                                )}
                                                                                {isSent && (
                                                                                    <>
                                                                                        {sr.signing_url && (
                                                                                            <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                                <a href={sr.signing_url} target="_blank" rel="noreferrer">Sign in person</a>
                                                                                            </DropdownMenuItem>
                                                                                        )}
                                                                                        <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                            <a href={`/signing-requests/${sr.id}/download?preview=1`} target="_blank" rel="noreferrer">Download as sent</a>
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuItem
                                                                                            className="whitespace-nowrap"
                                                                                            onClick={() => openResendDialog(sr)}
                                                                                        >
                                                                                            Resend
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuSeparator />
                                                                                        <DropdownMenuItem
                                                                                            className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                                            onClick={() => router.post(`/signing-requests/${sr.id}/cancel`, {}, { preserveScroll: true })}
                                                                                        >
                                                                                            Cancel
                                                                                        </DropdownMenuItem>
                                                                                    </>
                                                                                )}
                                                                                {isAwaitingInternal && (
                                                                                    <>
                                                                                        <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                                            <a href={`/signing-requests/${sr.id}/download?preview=1`} target="_blank" rel="noreferrer">Download as sent</a>
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuItem
                                                                                            className="whitespace-nowrap"
                                                                                            onClick={() => router.post(`/signing-requests/${sr.id}/resend`, {}, { preserveScroll: true })}
                                                                                        >
                                                                                            {sr.internal_signer ? `Remind ${sr.internal_signer.name}` : 'Send reminder'}
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuSeparator />
                                                                                        <DropdownMenuItem
                                                                                            className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                                            onClick={() => router.post(`/signing-requests/${sr.id}/cancel`, {}, { preserveScroll: true })}
                                                                                        >
                                                                                            Cancel
                                                                                        </DropdownMenuItem>
                                                                                    </>
                                                                                )}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="mt-1 text-[10px] text-muted-foreground">{statusTimestamp}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* FILES */}
                        {activeSection === 'files' && !emp.is_office_staff && <EmployeeFilesCard employeeId={emp.id} />}

                        {/* PROJECTS */}
                        {activeSection === 'projects' && !emp.is_office_staff && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <FolderOpen className="h-4 w-4" />
                                            Projects
                                        </CardTitle>
                                        <Button variant="outline" size="sm" className="gap-1.5" onClick={openLocationDialog}>
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit Locations
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <Separator className="mb-4" />
                                    {projects && projects.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {projects.map((project) => (
                                                <Link key={project.id} href={`/kiosks/${project.kiosk_id}/edit`}>
                                                    <Badge variant="outline" className="text-sm hover:bg-accent cursor-pointer">
                                                        {project.external_id || project.name}
                                                    </Badge>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm italic">No projects assigned</p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* INJURY REGISTER */}
                        {activeSection === 'forms' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <ClipboardList className="h-4 w-4" />
                                        Forms
                                    </CardTitle>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        onClick={() => {
                                            const first = formTemplates[0] ?? null;
                                            setSelectedTemplateId(first?.id ?? null);
                                            if (first) {
                                                if (first.filled_by === 'user') {
                                                    setSelectedDelivery('in_app');
                                                } else if (!first.is_sendable) {
                                                    setSelectedDelivery('in_person');
                                                } else if (hasEmail) {
                                                    setSelectedDelivery('email');
                                                } else if (hasMobileForForm) {
                                                    setSelectedDelivery('sms');
                                                } else {
                                                    setSelectedDelivery('in_person');
                                                }
                                            }
                                            setStartFormDialogOpen(true);
                                        }}
                                        disabled={formTemplates.length === 0}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Start a form
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-4" />
                                {formTemplates.length === 0 && (
                                    <p className="text-muted-foreground mb-3 text-xs italic">
                                        No form templates configured for employees. Create one in Form Templates with model type set to Employee.
                                    </p>
                                )}
                                {formRequests.length === 0 ? (
                                    <p className="text-muted-foreground text-sm italic">No forms yet. Click <span className="text-foreground font-medium">Start a form</span> to fill one out for this employee.</p>
                                ) : (
                                    <div className="overflow-hidden rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="px-3 text-xs">Form</TableHead>
                                                    <TableHead className="px-3 text-xs">Status</TableHead>
                                                    <TableHead className="px-3 text-xs">Delivery</TableHead>
                                                    <TableHead className="px-3 text-xs">Started by</TableHead>
                                                    <TableHead className="px-3 text-xs">Submitted</TableHead>
                                                    <TableHead className="w-10 px-3"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formRequests.map((fr) => {
                                                    const isSubmitted = fr.status === 'submitted';
                                                    const isPending = !isSubmitted && fr.status !== 'cancelled';
                                                    const fillable = isPending && canFillFormRequest(fr);
                                                    const deliveryLabel = fr.delivery_method === 'in_app'
                                                        ? 'Self-fill'
                                                        : fr.delivery_method === 'email'
                                                        ? 'Email'
                                                        : fr.delivery_method === 'sms'
                                                        ? 'SMS'
                                                        : 'In person';
                                                    return (
                                                        <TableRow key={fr.id}>
                                                            <TableCell className="px-3 text-xs font-medium">
                                                                {fr.form_template?.name ?? 'Form'}
                                                            </TableCell>
                                                            <TableCell className="px-3">
                                                                <Badge
                                                                    variant={isSubmitted ? 'default' : isPending ? 'secondary' : 'outline'}
                                                                    className="text-[10px] capitalize"
                                                                >
                                                                    {isPending ? 'Open' : fr.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="px-3 text-xs text-muted-foreground">
                                                                {deliveryLabel}
                                                            </TableCell>
                                                            <TableCell className="px-3 text-xs text-muted-foreground">
                                                                {fr.sent_by?.name ?? '—'}
                                                            </TableCell>
                                                            <TableCell className="px-3 text-xs text-muted-foreground">
                                                                {fr.submitted_at ? formatDate(fr.submitted_at) : '—'}
                                                            </TableCell>
                                                            <TableCell className="px-3">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon-sm" aria-label="Form actions">
                                                                            <EllipsisVertical className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-36">
                                                                        {fillable && (
                                                                            <DropdownMenuItem
                                                                                onClick={() => setFillingFormRequest(fr)}
                                                                                disabled={!fr.form_template?.fields?.length}
                                                                            >
                                                                                <Pencil className="mr-2 h-3.5 w-3.5" /> Fill
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {isSubmitted && (
                                                                            <DropdownMenuItem onClick={() => setViewingFormRequest(fr)}>
                                                                                <Eye className="mr-2 h-3.5 w-3.5" /> View
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {isPending && (
                                                                            <>
                                                                                {fillable && <DropdownMenuSeparator />}
                                                                                <DropdownMenuItem
                                                                                    className="text-destructive"
                                                                                    onClick={() => setConfirmCancelFormId(fr.id)}
                                                                                >
                                                                                    <XCircle className="mr-2 h-3.5 w-3.5" /> Cancel
                                                                                </DropdownMenuItem>
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        )}

                        {activeSection === 'injuries' && !emp.is_office_staff && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <AlertTriangle className="h-4 w-4" />
                                    Injury Register
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-4" />
                                {emp.incident_reports && emp.incident_reports.length > 0 ? (
                                    <div className="overflow-hidden rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="px-3 text-xs">ID</TableHead>
                                                    <TableHead className="px-3 text-xs">Occurred at</TableHead>
                                                    <TableHead className="px-3 text-xs">Project</TableHead>
                                                    <TableHead className="px-3 text-xs">Incident</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {emp.incident_reports.map((report) => (
                                                    <TableRow key={report.id}>
                                                        <TableCell className="px-3 text-xs font-medium">{report.report_number}</TableCell>
                                                        <TableCell className="px-3 text-xs">{formatDate(report.incident_date)}</TableCell>
                                                        <TableCell className="px-3 text-xs">
                                                            {report.project_name || report.location?.external_id || '—'}
                                                        </TableCell>
                                                        <TableCell className="px-3">
                                                            {report.incident_type ? (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {report.incident_type}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No injury register records found</p>
                                )}
                            </CardContent>
                        </Card>
                        )}
                    </main>
                </div>
            </div>

            {/* Delete Journal Entry Confirmation */}
            <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Journal Entry</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this journal entry? This cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => confirmDeleteId && deleteJournal(confirmDeleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Locations Dialog */}
            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogContent className="max-h-[80vh] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Location Access</DialogTitle>
                        <DialogDescription>
                            Select which locations {emp.display_name} should have access to.
                        </DialogDescription>
                    </DialogHeader>

                    {locationError && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
                            {locationError}
                        </div>
                    )}

                    {locationSuccess && (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                            <Check className="h-4 w-4" />
                            {locationSuccess}
                        </div>
                    )}

                    {httpGetLocations.processing ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                            <span className="text-muted-foreground ml-2 text-sm">Loading current locations...</span>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search locations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto">
                                <div className="flex flex-col gap-1">
                                    {filteredLocations.map((loc) => (
                                        <label
                                            key={loc.id}
                                            className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors"
                                        >
                                            <Checkbox
                                                checked={selectedLocationNames.has(loc.name)}
                                                onCheckedChange={() => toggleLocation(loc.name)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{loc.name}</p>
                                                {loc.externalId && (
                                                    <p className="text-muted-foreground text-xs truncate">{loc.externalId}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                    {filteredLocations.length === 0 && (
                                        <p className="text-muted-foreground py-4 text-center text-sm">No locations found</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <DialogFooter>
                        <div className="flex items-center justify-between w-full">
                            <span className="text-muted-foreground text-xs">
                                {selectedLocationNames.size} location{selectedLocationNames.size !== 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setLocationDialogOpen(false)} disabled={httpSaveLocations.processing}>
                                    Cancel
                                </Button>
                                <Button onClick={saveLocations} disabled={httpSaveLocations.processing || httpGetLocations.processing}>
                                    {httpSaveLocations.processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Send for Signing Modal */}
            {canSendDocuments && (
                <SendForSigningModal
                    open={showSigningModal}
                    onOpenChange={(open) => {
                        setShowSigningModal(open);
                        if (!open) setEditingDraft(null);
                    }}
                    templates={documentTemplates ?? []}
                    recipientName={emp.display_name || emp.name}
                    recipientEmail={emp.email ?? ''}
                    availablePlaceholders={availablePlaceholders ?? []}
                    savedSenderSignatureUrl={savedSenderSignatureUrl ?? null}
                    appUsers={appUsers ?? []}
                    signableType="App\Models\Employee"
                    signableId={emp.id}
                    draft={editingDraft ? {
                        id: editingDraft.id,
                        document_title: editingDraft.document_title,
                        document_html: editingDraft.document_html,
                        recipient_name: editingDraft.recipient_name,
                        recipient_email: editingDraft.recipient_email,
                    } : null}
                />
            )}

            {/* Discard draft confirmation */}
            <Dialog open={confirmDiscardDraftId !== null} onOpenChange={(open) => !open && setConfirmDiscardDraftId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Discard draft?</DialogTitle>
                        <DialogDescription>This will permanently delete the draft. This can't be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDiscardDraftId(null)}>Keep</Button>
                        <Button variant="destructive" onClick={() => confirmDiscardDraftId !== null && discardDraft(confirmDiscardDraftId)}>Discard</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Single-row resend with delivery method picker */}
            <Dialog open={resendTarget !== null} onOpenChange={(open) => !open && setResendTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resend document</DialogTitle>
                        <DialogDescription>
                            Choose how to notify {resendTarget?.recipient_name || 'the recipient'}. A fresh signing link will be issued; the previous request will be cancelled.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                            <Checkbox
                                checked={resendChannels.email}
                                onCheckedChange={(c) => setResendChannels((prev) => ({ ...prev, email: Boolean(c) }))}
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-xs text-muted-foreground">
                                    {resendTarget?.recipient_email || 'No email on file'}
                                </p>
                            </div>
                        </label>
                        <label className={`flex items-start gap-3 rounded-md border p-3 ${hasMobile ? 'cursor-pointer hover:bg-muted/40' : 'opacity-60 cursor-not-allowed'}`}>
                            <Checkbox
                                checked={resendChannels.sms}
                                disabled={!hasMobile}
                                onCheckedChange={(c) => setResendChannels((prev) => ({ ...prev, sms: Boolean(c) }))}
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <p className="text-sm font-medium">SMS</p>
                                <p className="text-xs text-muted-foreground">
                                    {hasMobile
                                        ? `${emp.mobile_number} — sends a text with a short signing link`
                                        : 'No mobile number on file for this employee'}
                                </p>
                            </div>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResendTarget(null)}>Cancel</Button>
                        <Button
                            onClick={runResend}
                            disabled={!resendChannels.email && !resendChannels.sms}
                        >
                            Resend
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk cancel confirmation */}
            <AlertDialog open={confirmBulkCancel} onOpenChange={setConfirmBulkCancel}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel {cancellableSelectedCount} signing request{cancellableSelectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The selected pending signing requests will be cancelled. The recipient will no longer be able to sign them. This can't be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={runBulkCancel}>Cancel selected</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk resend confirmation */}
            <Dialog open={confirmBulkResend} onOpenChange={setConfirmBulkResend}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Resend / remind {resendableSelectedCount} signing request{resendableSelectedCount === 1 ? '' : 's'}?
                        </DialogTitle>
                        <DialogDescription>
                            Recipients get fresh signing links; rows awaiting an internal signer get a reminder to the assigned signer (internal reminders always email regardless of the choice below).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                            <Checkbox
                                checked={bulkResendChannels.email}
                                onCheckedChange={(c) => setBulkResendChannels((prev) => ({ ...prev, email: Boolean(c) }))}
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-xs text-muted-foreground">One consolidated email per recipient.</p>
                            </div>
                        </label>
                        <label className={`flex items-start gap-3 rounded-md border p-3 ${hasMobile ? 'cursor-pointer hover:bg-muted/40' : 'opacity-60 cursor-not-allowed'}`}>
                            <Checkbox
                                checked={bulkResendChannels.sms}
                                disabled={!hasMobile}
                                onCheckedChange={(c) => setBulkResendChannels((prev) => ({ ...prev, sms: Boolean(c) }))}
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <p className="text-sm font-medium">SMS</p>
                                <p className="text-xs text-muted-foreground">
                                    {hasMobile
                                        ? `One text per document with a short signing link (to ${emp.mobile_number}).`
                                        : 'No mobile number on file for this employee.'}
                                </p>
                            </div>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmBulkResend(false)}>Cancel</Button>
                        <Button
                            onClick={runBulkResend}
                            disabled={!bulkResendChannels.email && !bulkResendChannels.sms}
                        >
                            Send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Start a form dialog */}
            <Dialog open={startFormDialogOpen} onOpenChange={(open) => {
                setStartFormDialogOpen(open);
                if (!open) {
                    setSelectedTemplateId(null);
                    setSelectedDelivery('in_app');
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Start a form</DialogTitle>
                        <DialogDescription>
                            Pick a form and how it'll be completed for {emp.display_name || emp.name}.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Step 1: pick template */}
                    <div className="flex flex-col gap-1.5">
                        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Form</p>
                        {formTemplates.length === 0 ? (
                            <p className="text-muted-foreground text-xs italic">No form templates available.</p>
                        ) : (
                            formTemplates.map((tpl) => {
                                const isSelected = selectedTemplateId === tpl.id;
                                return (
                                    <button
                                        type="button"
                                        key={tpl.id}
                                        onClick={() => {
                                            setSelectedTemplateId(tpl.id);
                                            // Reset delivery to the only option compatible with this template.
                                            // user-filled → in_app. subject-filled → first sendable option, else in_person.
                                            if (tpl.filled_by === 'user') {
                                                setSelectedDelivery('in_app');
                                            } else if (!tpl.is_sendable) {
                                                setSelectedDelivery('in_person');
                                            } else if (hasEmail) {
                                                setSelectedDelivery('email');
                                            } else if (hasMobileForForm) {
                                                setSelectedDelivery('sms');
                                            } else {
                                                setSelectedDelivery('in_person');
                                            }
                                        }}
                                        className={`flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors ${
                                            isSelected
                                                ? 'border-primary bg-accent/40'
                                                : 'hover:bg-accent/30'
                                        }`}
                                    >
                                        <span className="text-sm font-medium">{tpl.name}</span>
                                        {tpl.description && (
                                            <span className="text-muted-foreground text-xs">{tpl.description}</span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Step 2: pick delivery — gated on template.filled_by */}
                    {selectedTemplate && (() => {
                        const isUserFilled = selectedTemplate.filled_by === 'user';
                        const allowSendToSubject = selectedTemplate.is_sendable;

                        const options: { id: typeof selectedDelivery; label: string; sub: string; icon: typeof Mail; disabled?: string }[] = isUserFilled
                            ? [
                                  {
                                      id: 'in_app',
                                      label: 'Fill it now',
                                      sub: selectedTemplate.assignee_permission
                                          ? `Anyone with "${selectedTemplate.assignee_permission}" can complete it`
                                          : 'Complete the form in the side pane',
                                      icon: UserCheck,
                                  },
                              ]
                            : [
                                  {
                                      id: 'email',
                                      label: 'Email to employee',
                                      sub: hasEmail ? `Send link to ${emp.email}` : 'No email on file',
                                      icon: Mail,
                                      disabled: !allowSendToSubject
                                          ? 'Template is not sendable — must be in person'
                                          : !hasEmail
                                          ? 'No email on file'
                                          : undefined,
                                  },
                                  {
                                      id: 'sms',
                                      label: 'SMS to employee',
                                      sub: hasMobileForForm ? `Send link to ${emp.mobile_number}` : 'No mobile number on file',
                                      icon: MessageSquare,
                                      disabled: !allowSendToSubject
                                          ? 'Template is not sendable — must be in person'
                                          : !hasMobileForForm
                                          ? 'No mobile number on file'
                                          : undefined,
                                  },
                                  {
                                      id: 'in_person',
                                      label: 'Hand to employee in person',
                                      sub: 'No notification sent — hand them a tablet',
                                      icon: HandMetal,
                                  },
                              ];

                        return (
                            <div className="mt-3 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Delivery</p>
                                    <span className="text-muted-foreground text-[10px]">
                                        {isUserFilled ? 'Filled by a user' : 'Filled by the employee'}
                                    </span>
                                </div>
                                {options.map((opt) => {
                                    const Icon = opt.icon;
                                    const isSelected = selectedDelivery === opt.id;
                                    const isDisabled = Boolean(opt.disabled);
                                    return (
                                        <button
                                            type="button"
                                            key={opt.id}
                                            disabled={isDisabled}
                                            onClick={() => setSelectedDelivery(opt.id)}
                                            className={`flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                                                isDisabled
                                                    ? 'cursor-not-allowed opacity-50'
                                                    : isSelected
                                                    ? 'border-primary bg-accent/40'
                                                    : 'hover:bg-accent/30'
                                            }`}
                                        >
                                            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium leading-tight">{opt.label}</p>
                                                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                                    {opt.disabled ?? opt.sub}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStartFormDialogOpen(false)} disabled={startingForm}>
                            Cancel
                        </Button>
                        <Button onClick={startForm} disabled={!selectedTemplateId || startingForm}>
                            {startingForm ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Starting…
                                </>
                            ) : selectedDelivery === 'in_app' ? (
                                'Start & fill'
                            ) : selectedDelivery === 'email' ? (
                                'Send via email'
                            ) : selectedDelivery === 'sms' ? (
                                'Send via SMS'
                            ) : (
                                'Create for in-person'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel form confirmation */}
            <AlertDialog open={confirmCancelFormId !== null} onOpenChange={(open) => !open && setConfirmCancelFormId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this form?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The form will be marked cancelled and can no longer be filled out. This can't be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep form</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!confirmCancelFormId) return;
                                router.post(`/form-requests/${confirmCancelFormId}/cancel`, {}, {
                                    preserveScroll: true,
                                    onSuccess: () => setConfirmCancelFormId(null),
                                });
                            }}
                        >
                            Cancel form
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Fill pane */}
            <FormFillPane
                formRequest={fillingFormRequest}
                onClose={() => setFillingFormRequest(null)}
            />

            {/* Read-only response pane */}
            <FormResponsePane
                formRequest={viewingFormRequest}
                onClose={() => setViewingFormRequest(null)}
            />

        </AppLayout>
    );
}

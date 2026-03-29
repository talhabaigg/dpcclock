import SendForSigningModal from '@/components/signing/send-for-signing-modal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Calendar,
    Check,
    CheckCircle2,
    CheckSquare,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clipboard,
    ClipboardList,
    ExternalLink,
    FileIcon,
    History,
    ListChecks,
    Loader2,
    Mail,
    MapPin,
    Paperclip,
    Pencil,
    Phone,
    Plus,
    Send,
    Settings,
    Share2,
    Trash2,
    User,
    Wrench,
    FileSignature,
    XCircle,
    XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Skill {
    id: number;
    skill_name: string;
    is_custom: boolean;
}

interface ReferenceCheckData {
    id: number;
    referee_current_job_title: string | null;
    referee_current_employer: string | null;
    telephone: string | null;
    email: string | null;
    prepared_to_provide_reference: boolean | null;
    employment_from: string | null;
    employment_to: string | null;
    dates_align: boolean | null;
    relationship: string | null;
    relationship_duration: string | null;
    company_at_time: string | null;
    applicant_job_title: string | null;
    applicant_job_title_other: string | null;
    duties: string[] | null;
    performance_rating: string | null;
    honest_work_ethic: string | null;
    punctual: string | null;
    sick_days: string | null;
    reason_for_leaving: string | null;
    greatest_strengths: string | null;
    would_rehire: string | null;
    completed_by_name: string | null;
    completed_by_position: string | null;
    completed_date: string | null;
    completed_at: string | null;
    completed_by_user: { id: number; name: string } | null;
}

interface Reference {
    id: number;
    sort_order: number;
    company_name: string;
    position: string;
    employment_period: string;
    contact_person: string;
    phone_number: string;
    reference_check: ReferenceCheckData | null;
}

interface UserModel {
    id: number;
    name: string;
}

interface Attachment {
    id: number;
    name: string;
    url: string;
    size: number;
    mime_type: string;
}

interface CommentData {
    id: number;
    body: string;
    metadata: Record<string, unknown> | null;
    user: UserModel | null;
    created_at: string;
    attachments: Attachment[];
    replies?: CommentData[];
}

interface ChecklistItemData {
    id: number;
    checklist_id: number;
    label: string;
    sort_order: number;
    is_required: boolean;
    completed_at: string | null;
    completed_by: number | null;
    completed_by_user: UserModel | null;
    notes: string | null;
}

interface ChecklistData {
    id: number;
    name: string;
    checklist_template_id: number | null;
    sort_order: number;
    items: ChecklistItemData[];
}

interface TemplateOption {
    id: number;
    name: string;
}

interface Application {
    id: number;
    first_name: string;
    surname: string;
    suburb: string;
    email: string;
    phone: string;
    date_of_birth: string;
    why_should_we_employ_you: string;
    referred_by: string | null;
    aboriginal_or_tsi: boolean | null;
    occupation: string;
    apprentice_year: number | null;
    trade_qualified: boolean | null;
    occupation_other: string | null;
    preferred_project_site: string | null;
    safety_induction_number: string;
    ewp_below_11m: boolean;
    ewp_above_11m: boolean;
    forklift_licence_number: string | null;
    work_safely_at_heights: boolean;
    scaffold_licence_number: string | null;
    first_aid_completion_date: string | null;
    workplace_impairment_training: boolean;
    wit_completion_date: string | null;
    asbestos_awareness_training: boolean;
    crystalline_silica_course: boolean;
    gender_equity_training: boolean;
    quantitative_fit_test: string;
    workcover_claim: boolean | null;
    medical_condition: string | null;
    medical_condition_other: string | null;
    acceptance_full_name: string;
    acceptance_email: string;
    acceptance_date: string;
    declaration_accepted: boolean;
    status: string;
    declined_at: string | null;
    declined_by: number | null;
    declined_reason: string | null;
    declined_by_user: UserModel | null;
    created_at: string;
    skills: Skill[];
    references: Reference[];
}

interface ActivityEntry {
    id: number;
    event: string;
    user: UserModel | null;
    old: Record<string, unknown>;
    new: Record<string, unknown>;
    created_at: string;
}

interface Duplicate {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    status: string;
    created_at: string;
}

interface SigningRequestData {
    id: number;
    status: string;
    delivery_method: string;
    recipient_name: string;
    recipient_email: string | null;
    signed_at: string | null;
    opened_at: string | null;
    viewed_at: string | null;
    expires_at: string;
    signer_full_name: string | null;
    document_template: { id: number; name: string } | null;
    sent_by: { id: number; name: string } | null;
}

interface FormRequestData {
    id: number;
    status: string;
    delivery_method: string;
    recipient_name: string;
    recipient_email: string | null;
    submitted_at: string | null;
    opened_at: string | null;
    expires_at: string | null;
    responses: Record<string, unknown> | null;
    form_template: { id: number; name: string } | null;
    sent_by: { id: number; name: string } | null;
}

interface FormTemplateOption {
    id: number;
    name: string;
    description: string | null;
    fields_count: number;
}

interface DocumentTemplateOption {
    id: number;
    name: string;
    placeholders: { key: string; label: string }[] | null;
    body_html: string | null;
}

interface OnboardingLocation {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
}

interface PageProps {
    application: Application;
    comments: CommentData[];
    checklists: ChecklistData[];
    availableTemplates: TemplateOption[];
    duplicates: Duplicate[];
    auth: { permissions?: string[]; isAdmin?: boolean };
    signingRequests: SigningRequestData[];
    documentTemplates: DocumentTemplateOption[];
    formTemplates: FormTemplateOption[];
    formRequests: FormRequestData[];
    onboardingLocations: Record<string, OnboardingLocation[]>;
    screeningAlert?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    approved: 'Approved',
    contract_sent: 'Contract Sent',
    contract_signed: 'Contract Signed',
    onboarded: 'Onboarded',
    declined: 'Declined',
};

const PIPELINE_STATUSES = ['new', 'reviewing', 'phone_interview', 'reference_check', 'face_to_face', 'approved', 'contract_sent', 'contract_signed', 'onboarded'];

/** Statuses set only by the system (signing service, event listeners, onboarding) — not user-selectable */
const SYSTEM_STATUSES = ['contract_sent', 'contract_signed', 'onboarded'];

/** Statuses that are selectable in the dropdown */
const SELECTABLE_STATUSES = PIPELINE_STATUSES.filter((s) => !SYSTEM_STATUSES.includes(s));

function StatusBadge({ status, className }: { status: string; className?: string }) {
    return (
        <Badge variant="secondary" className={cn('text-xs', className)}>
            {STATUS_LABELS[status] ?? status}
        </Badge>
    );
}

function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function SidebarAttribute({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2">
            <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">{label}</p>
                <div className="text-sm">{children}</div>
            </div>
        </div>
    );
}

function getInitials(name: string): string {
    return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
    return (
        <Avatar className={cn('h-8 w-8', className)}>
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

function CommentBubble({ comment, currentUserId, onEdit, onDelete, onOpenRefCheck }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
    onOpenRefCheck?: (referenceId: number) => void;
}) {
    const isSystem = comment.metadata !== null;
    const statusChange = comment.metadata?.status_change as { from: string; to: string } | undefined;
    const refCheckMeta = comment.metadata?.reference_check as { id: number; reference_id: number; referee_name: string } | undefined;
    const contractSignedMeta = comment.metadata?.type === 'contract_signed' ? comment.metadata as { type: string; signing_request_id: number } : undefined;
    const formSubmittedMeta = comment.metadata?.type === 'form_submitted' ? comment.metadata as { type: string; form_request_id: number; form_name: string; responses: Record<string, string> } : undefined;
    const onboardedMeta = comment.metadata?.type === 'onboarded' ? comment.metadata as { type: string; eh_employee_id: number; location_name: string; company_code: string } : undefined;
    const isOwner = currentUserId !== undefined && comment.user?.id === currentUserId;

    if (isSystem && onboardedMeta) {
        return (
            <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground"> {comment.body}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                </div>
            </div>
        );
    }

    if (isSystem && contractSignedMeta) {
        return (
            <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <FileSignature className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground"> {comment.body}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                    <button
                        type="button"
                        onClick={() => window.open(route('signing-requests.download', contractSignedMeta.signing_request_id), '_blank')}
                        className="mt-1.5 flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-green-700 shadow-sm hover:bg-green-50 transition-colors"
                    >
                        <FileSignature className="h-3.5 w-3.5" />
                        View Signed Document
                    </button>
                </div>
            </div>
        );
    }

    if (isSystem && formSubmittedMeta) {
        return (
            <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
                    <Clipboard className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground"> {comment.body}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                    {formSubmittedMeta.responses && (
                        <div className="mt-2 rounded-md border bg-purple-50/50 p-3 dark:bg-purple-950/20">
                            <p className="mb-1.5 text-xs font-medium text-purple-700 dark:text-purple-300">Responses</p>
                            <div className="space-y-1">
                                {Object.entries(formSubmittedMeta.responses).map(([label, value]) => (
                                    <div key={label} className="flex gap-2 text-xs">
                                        <span className="font-medium text-muted-foreground shrink-0">{label}:</span>
                                        <span className="text-foreground">{Array.isArray(value) ? value.join(', ') : String(value || '—')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (isSystem && refCheckMeta) {
        return (
            <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground"> completed reference check for </span>
                        <span className="font-medium">{refCheckMeta.referee_name}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                    <button
                        type="button"
                        onClick={() => onOpenRefCheck?.(refCheckMeta.reference_id)}
                        className="mt-1.5 flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 transition-colors"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        View Reference Check
                    </button>
                </div>
            </div>
        );
    }

    if (isSystem && statusChange) {
        return (
            <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground"> changed status </span>
                        <StatusBadge status={statusChange.from} className="mx-0.5" />
                        <ArrowRight className="mx-0.5 inline h-3 w-3" />
                        <StatusBadge status={statusChange.to} className="mx-0.5" />
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-3">
            {comment.user ? (
                <UserAvatar name={comment.user.name} />
            ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
            )}
            <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{formatDateTime(comment.created_at)}</span>
                    </p>
                    {isOwner && !isSystem && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground ml-auto shrink-0 p-0.5">
                                    <Settings className="h-4 w-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="flex w-auto gap-1 p-1.5" side="top" align="end">
                                <Button
                                    size="sm"
                                    className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                                    onClick={() => onEdit?.(comment)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 gap-1.5"
                                    onClick={() => onDelete?.(comment.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </Button>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
                {comment.body && <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>}
                {comment.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {comment.attachments.map((att) =>
                            att.mime_type.startsWith('image/') ? (
                                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img src={att.url} alt={att.name} className="max-h-48 rounded-lg border object-cover" />
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
                                    <span className="text-muted-foreground shrink-0">({formatFileSize(att.size)})</span>
                                </a>
                            ),
                        )}
                    </div>
                )}
                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 pl-4">
                        {comment.replies.map((reply) => (
                            <CommentBubble key={reply.id} comment={reply} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ChecklistSection({
    checklists,
    availableTemplates,
    applicationId,
    canScreen,
}: {
    checklists: ChecklistData[];
    availableTemplates: TemplateOption[];
    applicationId: number;
    canScreen: boolean;
}) {
    const [addingItemTo, setAddingItemTo] = useState<number | null>(null);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [togglingItems, setTogglingItems] = useState<Set<number>>(new Set());
    const [collapsedChecklists, setCollapsedChecklists] = useState<Set<number>>(new Set());
    const [showAddChecklist, setShowAddChecklist] = useState(false);
    const [adHocName, setAdHocName] = useState('');
    const [adHocItems, setAdHocItems] = useState<string[]>(['']);
    const [showQuickAddItem, setShowQuickAddItem] = useState(false);
    const [quickItemLabel, setQuickItemLabel] = useState('');
    const [quickItemChecklistId, setQuickItemChecklistId] = useState<number | null>(null);
    const [confirmDeleteChecklistId, setConfirmDeleteChecklistId] = useState<number | null>(null);
    const [historyItem, setHistoryItem] = useState<ChecklistItemData | null>(null);
    const [historyEntries, setHistoryEntries] = useState<ActivityEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const openHistory = useCallback((item: ChecklistItemData) => {
        setHistoryItem(item);
        setHistoryLoading(true);
        setHistoryEntries([]);
        fetch(route('checklist-items.history', item.id), {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((res) => res.json())
            .then((data) => setHistoryEntries(data.activities ?? []))
            .finally(() => setHistoryLoading(false));
    }, []);

    const totalItems = checklists.reduce((sum, cl) => sum + cl.items.length, 0);
    const completedItems = checklists.reduce(
        (sum, cl) => sum + cl.items.filter((i) => i.completed_at).length, 0,
    );
    const requiredIncomplete = checklists.reduce(
        (sum, cl) => sum + cl.items.filter((i) => i.is_required && !i.completed_at).length, 0,
    );

    function toggleCollapse(checklistId: number) {
        setCollapsedChecklists((prev) => {
            const next = new Set(prev);
            if (next.has(checklistId)) { next.delete(checklistId); } else { next.add(checklistId); }
            return next;
        });
    }

    function handleToggleItem(itemId: number) {
        setTogglingItems((prev) => new Set(prev).add(itemId));
        router.patch(route('checklist-items.toggle', itemId), {}, {
            preserveScroll: true,
            onFinish: () => {
                setTogglingItems((prev) => {
                    const next = new Set(prev);
                    next.delete(itemId);
                    return next;
                });
            },
        });
    }

    function handleAddItem(checklistId: number) {
        if (!newItemLabel.trim()) return;
        router.post(route('checklists.add-item', checklistId), { label: newItemLabel.trim() }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewItemLabel('');
                setAddingItemTo(null);
            },
        });
    }

    function handleDeleteItem(itemId: number) {
        router.delete(route('checklist-items.destroy', itemId), {
            preserveScroll: true,
        });
    }

    function handleDeleteChecklist(checklistId: number) {
        setConfirmDeleteChecklistId(checklistId);
    }

    function confirmDeleteChecklist() {
        if (confirmDeleteChecklistId === null) return;
        router.delete(route('checklists.destroy', confirmDeleteChecklistId), {
            preserveScroll: true,
            onFinish: () => setConfirmDeleteChecklistId(null),
        });
    }

    function handleQuickAddItem() {
        if (!quickItemLabel.trim()) return;
        const targetId = quickItemChecklistId ?? (checklists.length > 0 ? checklists[0].id : null);
        if (targetId) {
            router.post(route('checklists.add-item', targetId), { label: quickItemLabel.trim() }, {
                preserveScroll: true,
                onSuccess: () => { setQuickItemLabel(''); setShowQuickAddItem(false); setQuickItemChecklistId(null); },
            });
        } else {
            // No checklist exists — create a General one with this item
            router.post(route('checklists.ad-hoc'), {
                checkable_type: 'employment_application',
                checkable_id: applicationId,
                name: 'General',
                items: [{ label: quickItemLabel.trim() }],
            }, {
                preserveScroll: true,
                onSuccess: () => { setQuickItemLabel(''); setShowQuickAddItem(false); setQuickItemChecklistId(null); },
            });
        }
    }

    function handleAttachTemplate(templateId: string) {
        router.post(route('checklists.attach-template'), {
            checkable_type: 'employment_application',
            checkable_id: applicationId,
            checklist_template_id: Number(templateId),
        }, { preserveScroll: true });
    }

    function handleCreateAdHoc() {
        const items = adHocItems.filter((l) => l.trim() !== '').map((l) => ({ label: l.trim() }));
        if (items.length === 0) return;
        router.post(route('checklists.ad-hoc'), {
            checkable_type: 'employment_application',
            checkable_id: applicationId,
            name: adHocName.trim() || 'General',
            items,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setShowAddChecklist(false);
                setAdHocName('');
                setAdHocItems(['']);
            },
        });
    }

    return (
        <div>
            <div className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">Checklists</h3>
                        {totalItems > 0 && (
                            <span className="text-muted-foreground text-xs">
                                {completedItems}/{totalItems}
                                {requiredIncomplete > 0 && (
                                    <span className="ml-1 text-amber-600">({requiredIncomplete} required remaining)</span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        {checklists.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => setCollapsedChecklists(new Set())}
                                >
                                    Expand all
                                </button>
                                <span className="text-muted-foreground/50">|</span>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => setCollapsedChecklists(new Set(checklists.map((c) => c.id)))}
                                >
                                    Collapse all
                                </button>
                            </>
                        )}
                        {canScreen && (
                            <button
                                type="button"
                                className="text-primary flex items-center gap-1 text-xs hover:underline"
                                onClick={() => { setShowQuickAddItem(true); setQuickItemChecklistId(checklists[0]?.id ?? null); }}
                            >
                                <Plus className="h-3 w-3" />
                                New item
                            </button>
                        )}
                        {canScreen && (
                            <span className="text-muted-foreground/50">|</span>
                        )}
                        {canScreen && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="text-primary flex items-center gap-1 text-xs hover:underline"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add checklist
                                        <ChevronDown className="h-3 w-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setShowAddChecklist(true)}>
                                        <ListChecks className="mr-2 h-3.5 w-3.5" />
                                        Create new checklist
                                    </DropdownMenuItem>
                                    {availableTemplates.length > 0 ? (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <Plus className="mr-2 h-3.5 w-3.5" />
                                                Add existing checklist
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent>
                                                {availableTemplates.map((t) => (
                                                    <DropdownMenuItem key={t.id} onClick={() => handleAttachTemplate(String(t.id))}>
                                                        {t.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    ) : (
                                        <DropdownMenuItem disabled>
                                            <Plus className="mr-2 h-3.5 w-3.5" />
                                            Add existing checklist
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </div>
            <div className="space-y-3">
                {showQuickAddItem && (
                    <div className="flex items-center gap-2">
                        <Input
                            autoFocus
                            value={quickItemLabel}
                            onChange={(e) => setQuickItemLabel(e.target.value)}
                            placeholder="Item name..."
                            className="h-7 flex-1 text-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleQuickAddItem(); }
                                if (e.key === 'Escape') { setShowQuickAddItem(false); setQuickItemLabel(''); }
                            }}
                        />
                        {checklists.length > 1 && (
                            <Select value={String(quickItemChecklistId ?? checklists[0].id)} onValueChange={(v) => setQuickItemChecklistId(Number(v))}>
                                <SelectTrigger className="h-7 w-40 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {checklists.map((cl) => (
                                        <SelectItem key={cl.id} value={String(cl.id)}>{cl.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <button type="button" onClick={handleQuickAddItem} className="text-emerald-600 hover:text-emerald-700" title="Add item">
                            <Check className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => { setShowQuickAddItem(false); setQuickItemLabel(''); }} className="text-destructive hover:text-destructive/80" title="Cancel">
                            <XCircle className="h-4 w-4" />
                        </button>
                    </div>
                )}
                {checklists.length === 0 && !showAddChecklist && !showQuickAddItem && (
                    <p className="text-muted-foreground text-sm italic">No checklists attached yet.</p>
                )}

                {checklists.map((checklist) => {
                    const clCompleted = checklist.items.filter((i) => i.completed_at).length;
                    const clTotal = checklist.items.length;
                    const isCollapsed = collapsedChecklists.has(checklist.id);

                    return (
                        <div key={checklist.id} className="rounded-lg border">
                            {/* Checklist header */}
                            <div
                                className="flex cursor-pointer items-center gap-2 px-3 py-2"
                                onClick={() => toggleCollapse(checklist.id)}
                            >
                                <ChevronDown className={cn('h-4 w-4 transition-transform', isCollapsed && '-rotate-90')} />
                                <CheckSquare className="text-muted-foreground h-4 w-4" />
                                <span className="flex-1 text-sm font-medium">{checklist.name}</span>
                                <span className="text-muted-foreground text-xs">{clCompleted}/{clTotal}</span>
                                {/* Progress bar */}
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all',
                                            clCompleted === clTotal ? 'bg-emerald-500' : 'bg-primary',
                                        )}
                                        style={{ width: clTotal > 0 ? `${(clCompleted / clTotal) * 100}%` : '0%' }}
                                    />
                                </div>
                                {canScreen && (
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-destructive ml-1"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteChecklist(checklist.id); }}
                                        title="Remove checklist"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Items */}
                            {!isCollapsed && (
                                <div className="border-t px-3 py-1">
                                    {checklist.items.map((item) => (
                                        <div key={item.id} className="group flex items-start gap-2.5 py-1.5">
                                            <Checkbox
                                                checked={!!item.completed_at}
                                                disabled={!canScreen || togglingItems.has(item.id)}
                                                onCheckedChange={() => handleToggleItem(item.id)}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className={cn(
                                                    'text-sm',
                                                    item.completed_at && 'text-muted-foreground line-through',
                                                )}>
                                                    {item.label}
                                                </span>
                                                {item.is_required && !item.completed_at && (
                                                    <span className="ml-1.5 text-[10px] font-medium text-amber-600">Required</span>
                                                )}
                                                {item.completed_at && item.completed_by_user && (
                                                    <span className="text-muted-foreground ml-2 text-[10px]">
                                                        {item.completed_by_user.name} &middot; {formatDateTime(item.completed_at)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    className="text-muted-foreground hover:text-foreground invisible shrink-0 group-hover:visible"
                                                    onClick={() => openHistory(item)}
                                                    title="View history"
                                                >
                                                    <History className="h-3.5 w-3.5" />
                                                </button>
                                                {canScreen && (
                                                    <button
                                                        type="button"
                                                        className="text-muted-foreground hover:text-destructive invisible shrink-0 group-hover:visible"
                                                        onClick={() => handleDeleteItem(item.id)}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add item inline */}
                                    {canScreen && addingItemTo === checklist.id ? (
                                        <div className="flex items-center gap-2 py-1.5">
                                            <Input
                                                autoFocus
                                                value={newItemLabel}
                                                onChange={(e) => setNewItemLabel(e.target.value)}
                                                placeholder="New item..."
                                                className="h-7 flex-1 text-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); handleAddItem(checklist.id); }
                                                    if (e.key === 'Escape') { setAddingItemTo(null); setNewItemLabel(''); }
                                                }}
                                            />
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleAddItem(checklist.id)}>
                                                Add
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setAddingItemTo(null); setNewItemLabel(''); }}>
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : canScreen && (
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-primary flex items-center gap-1.5 py-1.5 text-xs"
                                            onClick={() => { setAddingItemTo(checklist.id); setNewItemLabel(''); }}
                                        >
                                            <Plus className="h-3 w-3" /> Add item
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Ad-hoc checklist creation */}
                {showAddChecklist && (
                    <div className="space-y-3 rounded-lg border p-3">
                        <div>
                            <Label className="text-xs">Checklist Name</Label>
                            <Input
                                value={adHocName}
                                onChange={(e) => setAdHocName(e.target.value)}
                                placeholder="e.g. Pre-Start Requirements"
                                className="mt-1 h-8 text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Items</Label>
                            <div className="mt-1 space-y-1.5">
                                {adHocItems.map((item, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <Input
                                            value={item}
                                            onChange={(e) => {
                                                const next = [...adHocItems];
                                                next[i] = e.target.value;
                                                setAdHocItems(next);
                                            }}
                                            placeholder={`Item ${i + 1}`}
                                            className="h-7 flex-1 text-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    setAdHocItems([...adHocItems, '']);
                                                }
                                            }}
                                        />
                                        {adHocItems.length > 1 && (
                                            <button type="button" onClick={() => setAdHocItems(adHocItems.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                                <XCircle className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
                                    onClick={() => setAdHocItems([...adHocItems, ''])}
                                >
                                    <Plus className="h-3 w-3" /> Add another item
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={handleCreateAdHoc}>Create</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddChecklist(false); setAdHocName(''); setAdHocItems(['']); }}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Checklist Confirm Dialog */}
            <Dialog open={confirmDeleteChecklistId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteChecklistId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Remove checklist?</DialogTitle>
                        <DialogDescription>This will permanently delete the checklist and all its items.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmDeleteChecklistId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteChecklist}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={historyItem !== null} onOpenChange={(open) => { if (!open) setHistoryItem(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Item History</DialogTitle>
                        <DialogDescription className="text-xs">
                            {historyItem?.label}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto">
                        {historyLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                            </div>
                        )}
                        {!historyLoading && historyEntries.length === 0 && (
                            <p className="text-muted-foreground py-8 text-center text-sm italic">No history recorded yet.</p>
                        )}
                        {!historyLoading && historyEntries.length > 0 && (
                            <div className="space-y-3">
                                {historyEntries.map((entry) => (
                                    <div key={entry.id} className="border-b pb-3 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <History className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                            <span className="text-sm font-medium capitalize">{entry.event}</span>
                                            <span className="text-muted-foreground ml-auto text-[10px]">{formatDateTime(entry.created_at)}</span>
                                        </div>
                                        {entry.user && (
                                            <p className="text-muted-foreground mt-0.5 pl-[22px] text-xs">by {entry.user.name}</p>
                                        )}
                                        <div className="mt-1.5 pl-[22px] text-xs">
                                            {Object.keys(entry.new).map((key) => {
                                                const oldVal = entry.old[key];
                                                const newVal = entry.new[key];
                                                const label = key.replace(/_/g, ' ');
                                                return (
                                                    <div key={key} className="flex items-baseline gap-1 py-0.5">
                                                        <span className="text-muted-foreground capitalize">{label}:</span>
                                                        {oldVal !== undefined && (
                                                            <>
                                                                <span className="text-red-500 line-through">{formatActivityValue(key, oldVal)}</span>
                                                                <ArrowRight className="mx-0.5 inline h-2.5 w-2.5" />
                                                            </>
                                                        )}
                                                        <span className="font-medium text-emerald-600">{formatActivityValue(key, newVal)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function formatActivityValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (key === 'completed_at') {
        return value ? formatDateTime(String(value)) : 'unchecked';
    }
    if (key === 'completed_by') {
        return value ? `User #${value}` : '—';
    }
    return String(value);
}

// ─── Reference Check Dialog ───────────────────────────────────────────────────

const REF_CHECK_DUTIES = [
    'Erecting Framework', 'Concealed Grid', 'Setting', 'Set Out',
    'Fix Plasterboard', 'Exposed Grid', 'Cornice', 'Other',
];

const PERF_OPTIONS = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'very_good', label: 'Very Good' },
    { value: 'good', label: 'Good' },
    { value: 'average', label: 'Average' },
    { value: 'poor', label: 'Poor' },
];

const YES_NO_SOMETIMES = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'sometimes', label: 'Sometimes' },
];

function blankForm(ref: Reference | null) {
    return {
        referee_current_job_title: '',
        referee_current_employer: '',
        telephone: ref?.phone_number ?? '',
        email: '',
        prepared_to_provide_reference: '' as string,
        employment_from: '',
        employment_to: '',
        dates_align: '' as string,
        relationship: '',
        relationship_duration: '',
        company_at_time: ref?.company_name ?? '',
        applicant_job_title: '',
        applicant_job_title_other: '',
        duties: [] as string[],
        performance_rating: '',
        honest_work_ethic: '',
        punctual: '',
        sick_days: '',
        reason_for_leaving: '',
        greatest_strengths: '',
        would_rehire: '',
    };
}

function RCField({ label, value }: { label: string; value: string | boolean | null | undefined }) {
    const display = value === null || value === undefined || value === '' ? '—' : String(value);
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <span className="text-sm">{display}</span>
        </div>
    );
}

function RCStepIndicator({ step, total }: { step: number; total: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: total }, (_, i) => (
                <div
                    key={i}
                    className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        i < step ? 'bg-primary' : 'bg-muted',
                    )}
                />
            ))}
        </div>
    );
}

function ReferenceCheckDialog({
    open,
    onClose,
    application,
    initialReferenceId,
    authUserName,
}: {
    open: boolean;
    onClose: () => void;
    application: Application;
    initialReferenceId?: number | null;
    authUserName: string;
}) {
    const [selectedRefId, setSelectedRefId] = useState<number | null>(initialReferenceId ?? null);
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(() => blankForm(null));
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const selectedRef = application.references.find((r) => r.id === selectedRefId) ?? null;

    // When dialog opens or initialReferenceId changes, sync selection
    useEffect(() => {
        if (open) {
            const refId = initialReferenceId ?? null;
            setSelectedRefId(refId);
            const ref = application.references.find((r) => r.id === refId) ?? null;
            if (ref && !ref.reference_check) {
                setForm(blankForm(ref));
                setStep(1);
            }
        }
    }, [open, initialReferenceId]);

    // When user picks a different ref, reset form if it has no check yet
    function selectRef(refId: number) {
        setSelectedRefId(refId);
        const ref = application.references.find((r) => r.id === refId) ?? null;
        if (ref && !ref.reference_check) {
            setForm(blankForm(ref));
            setStep(1);
        }
    }

    function set(key: string, value: unknown) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function toggleDuty(duty: string) {
        setForm((prev) => ({
            ...prev,
            duties: prev.duties.includes(duty)
                ? prev.duties.filter((d) => d !== duty)
                : [...prev.duties, duty],
        }));
    }

    function validate(): Record<string, string> {
        const errs: Record<string, string> = {};
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            errs.email = 'Please enter a valid email address.';
        }
        if (!form.would_rehire) {
            errs.would_rehire = 'Please indicate whether you would re-hire the applicant.';
        }
        return errs;
    }

    function handleSubmit() {
        if (!selectedRef) return;
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            // Jump to the step containing the first error
            if (errs.email) setStep(1);
            else if (errs.would_rehire) setStep(4);
            return;
        }
        setErrors({});
        setSubmitting(true);
        const payload = {
            ...form,
            prepared_to_provide_reference:
                form.prepared_to_provide_reference === 'true' ? true
                : form.prepared_to_provide_reference === 'false' ? false
                : null,
            dates_align:
                form.dates_align === 'true' ? true
                : form.dates_align === 'false' ? false
                : null,
        };
        router.post(`/employment-applications/references/${selectedRef.id}/check`, payload, {
            preserveScroll: true,
            onSuccess: () => { onClose(); },
            onError: (serverErrors) => {
                const mapped: Record<string, string> = {};
                Object.entries(serverErrors).forEach(([k, v]) => { mapped[k] = v; });
                setErrors(mapped);
                if (mapped.email) setStep(1);
            },
            onFinish: () => setSubmitting(false),
        });
    }

    const occupationDisplay =
        application.occupation === 'other' && application.occupation_other
            ? application.occupation_other
            : application.occupation.charAt(0).toUpperCase() + application.occupation.slice(1);

    const TOTAL_STEPS = 4;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-5 pb-4 border-b">
                    {selectedRef ? (
                        <button
                            type="button"
                            onClick={() => setSelectedRefId(null)}
                            className="text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 text-xs transition-colors"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" /> All references
                        </button>
                    ) : null}
                    <DialogTitle>Reference Check</DialogTitle>
                    <DialogDescription>
                        {selectedRef ? selectedRef.contact_person : `${application.first_name} ${application.surname}`}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                <div className="p-6">
                    {/* ── Selection screen ── */}
                    {!selectedRef ? (
                        <div className="space-y-3">
                            {application.references.map((ref) => (
                                <button
                                    key={ref.id}
                                    type="button"
                                    onClick={() => selectRef(ref.id)}
                                    className="hover:bg-muted w-full rounded-lg border bg-card p-4 text-left transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{ref.contact_person}</p>
                                            <p className="text-muted-foreground text-xs">{ref.company_name}</p>
                                            {ref.phone_number && (
                                                <p className="text-muted-foreground text-xs">{ref.phone_number}</p>
                                            )}
                                        </div>
                                        <div className="shrink-0">
                                            {ref.reference_check ? (
                                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                                                </span>
                                            ) : (
                                                <ChevronRight className="text-muted-foreground h-4 w-4" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : selectedRef.reference_check ? (
                        // ── Read-only view ──
                        <ReadOnlyRefCheck check={selectedRef.reference_check} ref_={selectedRef} occupationDisplay={occupationDisplay} />
                    ) : (
                        // ── Multi-step form ──
                        <div className="space-y-6">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-muted-foreground text-xs">Step {step} of {TOTAL_STEPS}</p>
                                        <p className="text-sm font-medium">
                                            {step === 1 && 'Introduction & Contact'}
                                            {step === 2 && 'Employment Details'}
                                            {step === 3 && 'Performance Assessment'}
                                            {step === 4 && 'Closing Questions'}
                                        </p>
                                    </div>
                                    <RCStepIndicator step={step} total={TOTAL_STEPS} />
                                </div>

                                {step === 1 && (
                                    <div className="space-y-4">
                                        <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm leading-relaxed space-y-2">
                                            <p>
                                                "My name is <strong>{authUserName}</strong> and I'm calling to conduct a reference check for{' '}
                                                <strong>{application.first_name} {application.surname}</strong>{' '}
                                                who is being considered for a position with Superior Walls &amp; Ceilings.
                                                Your details have been provided to me by <strong>{application.first_name} {application.surname}</strong>.
                                                Are you prepared to provide a reference? This discussion should take approximately 5 minutes."
                                            </p>
                                            <p className="text-muted-foreground italic">Is this the right time to call to have this discussion?</p>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Prepared to provide a reference?</Label>
                                            <RadioGroup
                                                value={form.prepared_to_provide_reference}
                                                onValueChange={(v) => set('prepared_to_provide_reference', v)}
                                                className="flex gap-4"
                                            >
                                                {[['true', 'Yes'], ['false', 'No']].map(([v, l]) => (
                                                    <div key={v} className="flex items-center gap-2">
                                                        <RadioGroupItem value={v} id={`prep_${v}`} />
                                                        <Label htmlFor={`prep_${v}`}>{l}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                        <div className="grid gap-4">
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="rc_job_title">Referee's Current Job Title</Label>
                                                <Input id="rc_job_title" value={form.referee_current_job_title} onChange={(e) => set('referee_current_job_title', e.target.value)} />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="rc_employer">Referee's Current Employer</Label>
                                                <Input id="rc_employer" value={form.referee_current_employer} onChange={(e) => set('referee_current_employer', e.target.value)} />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="rc_tel">Telephone</Label>
                                                <Input id="rc_tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="rc_email">Email</Label>
                                                <Input
                                                    id="rc_email"
                                                    type="email"
                                                    value={form.email}
                                                    onChange={(e) => { set('email', e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                                                    className={errors.email ? 'border-destructive' : ''}
                                                />
                                                {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-4">
                                        <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm leading-relaxed space-y-1">
                                            <p>If the referee is happy to proceed, confirm the applicant's employment details and general information by asking the following questions.</p>
                                            <p className="text-muted-foreground italic">
                                                "This reference will be used in the overall evaluation of the applicant and will affect whether they are selected for the job.
                                                The Applicant is being considered for the position of <strong>{occupationDisplay}</strong>.
                                                Could you please keep this in mind when answering the following questions?"
                                            </p>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Can you confirm the Applicant's dates of employment?</p>
                                            <Label htmlFor="rc_from">Employment From</Label>
                                            <Input id="rc_from" type="date" value={form.employment_from} onChange={(e) => set('employment_from', e.target.value)} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="rc_to">Employment To</Label>
                                            <Input id="rc_to" type="date" value={form.employment_to} onChange={(e) => set('employment_to', e.target.value)} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Do the dates align with the Job Enquiry?</p>
                                            <Label>Dates align with job enquiry?</Label>
                                            <RadioGroup value={form.dates_align} onValueChange={(v) => set('dates_align', v)} className="flex gap-4">
                                                {[['true', 'Yes'], ['false', 'No']].map(([v, l]) => (
                                                    <div key={v} className="flex items-center gap-2">
                                                        <RadioGroupItem value={v} id={`align_${v}`} />
                                                        <Label htmlFor={`align_${v}`}>{l}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">What is your relationship with the Applicant? <span className="font-medium">(Answer should be Supervisor or Manager)</span></p>
                                            <Label htmlFor="rc_rel">Relationship to Applicant</Label>
                                            <Input id="rc_rel" placeholder="e.g. Supervisor or Manager" value={form.relationship} onChange={(e) => set('relationship', e.target.value)} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">For how long? <span className="font-medium">☑ Check against applicant's history</span></p>
                                            <Label htmlFor="rc_dur">For How Long?</Label>
                                            <Input id="rc_dur" value={form.relationship_duration} onChange={(e) => set('relationship_duration', e.target.value)} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">What Company were you working for at the time? <span className="font-medium">(If company is not familiar, ask: "Are you Brisbane/Gold Coast based?", "Small commercial fit out?")</span></p>
                                            <Label htmlFor="rc_company">Company at the Time</Label>
                                            <Input id="rc_company" value={form.company_at_time} onChange={(e) => set('company_at_time', e.target.value)} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">What was the Applicant's job title?</p>
                                            <Label>Applicant's Job Title</Label>
                                            <RadioGroup value={form.applicant_job_title} onValueChange={(v) => set('applicant_job_title', v)} className="flex flex-wrap gap-4">
                                                {['plasterer', 'carpenter', 'labourer', 'other'].map((t) => (
                                                    <div key={t} className="flex items-center gap-2">
                                                        <RadioGroupItem value={t} id={`jt_${t}`} />
                                                        <Label htmlFor={`jt_${t}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                            {form.applicant_job_title === 'other' && (
                                                <Input placeholder="e.g. Apprentice" value={form.applicant_job_title_other} onChange={(e) => set('applicant_job_title_other', e.target.value)} />
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <p className="text-muted-foreground text-xs italic">What were the Applicant's main duties/responsibilities?</p>
                                            <Label>Main Duties / Responsibilities</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {REF_CHECK_DUTIES.map((duty) => (
                                                    <div key={duty} className="flex items-center gap-2">
                                                        <Checkbox id={`duty_${duty}`} checked={form.duties.includes(duty)} onCheckedChange={() => toggleDuty(duty)} />
                                                        <Label htmlFor={`duty_${duty}`} className="font-normal">{duty}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-4">
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Overall, how would you describe the Applicant's performance in the role?</p>
                                            <Label>Overall Performance</Label>
                                            <RadioGroup value={form.performance_rating} onValueChange={(v) => set('performance_rating', v)} className="flex flex-wrap gap-4">
                                                {PERF_OPTIONS.map((o) => (
                                                    <div key={o.value} className="flex items-center gap-2">
                                                        <RadioGroupItem value={o.value} id={`perf_${o.value}`} />
                                                        <Label htmlFor={`perf_${o.value}`}>{o.label}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Are they honest and do they have good work ethic?</p>
                                            <Label>Honest &amp; Good Work Ethic?</Label>
                                            <RadioGroup value={form.honest_work_ethic} onValueChange={(v) => set('honest_work_ethic', v)} className="flex flex-wrap gap-4">
                                                {PERF_OPTIONS.map((o) => (
                                                    <div key={o.value} className="flex items-center gap-2">
                                                        <RadioGroupItem value={o.value} id={`ethic_${o.value}`} />
                                                        <Label htmlFor={`ethic_${o.value}`}>{o.label}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Are they punctual? What was their attendance onsite like?</p>
                                            <Label>Punctual / Attendance?</Label>
                                            <RadioGroup value={form.punctual} onValueChange={(v) => set('punctual', v)} className="flex gap-4">
                                                {YES_NO_SOMETIMES.map((o) => (
                                                    <div key={o.value} className="flex items-center gap-2">
                                                        <RadioGroupItem value={o.value} id={`punc_${o.value}`} />
                                                        <Label htmlFor={`punc_${o.value}`}>{o.label}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Do they take many sick days off for any other reasons?</p>
                                            <Label>Takes Many Sick Days / Absences?</Label>
                                            <RadioGroup value={form.sick_days} onValueChange={(v) => set('sick_days', v)} className="flex gap-4">
                                                {YES_NO_SOMETIMES.map((o) => (
                                                    <div key={o.value} className="flex items-center gap-2">
                                                        <RadioGroupItem value={o.value} id={`sick_${o.value}`} />
                                                        <Label htmlFor={`sick_${o.value}`}>{o.label}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Do you know what was or is their reason for wanting to leave?</p>
                                            <Label htmlFor="rc_reason">Reason for Wanting to Leave</Label>
                                            <Textarea id="rc_reason" rows={3} value={form.reason_for_leaving} onChange={(e) => set('reason_for_leaving', e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-4">
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">What do you believe the Applicant's greatest strengths are? <span className="font-medium">"Are they better at framing, sheeting, or setting?"</span></p>
                                            <Label htmlFor="rc_strengths">Greatest Strengths</Label>
                                            <Textarea id="rc_strengths" rows={3} value={form.greatest_strengths} onChange={(e) => set('greatest_strengths', e.target.value)} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <p className="text-muted-foreground text-xs italic">Would you re-hire the Applicant?</p>
                                            <Label>Would You Re-hire the Applicant? <span className="text-destructive">*</span></Label>
                                            <RadioGroup
                                                value={form.would_rehire}
                                                onValueChange={(v) => { set('would_rehire', v); setErrors((p) => ({ ...p, would_rehire: '' })); }}
                                                className="flex gap-4"
                                            >
                                                {[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => (
                                                    <div key={v} className="flex items-center gap-2">
                                                        <RadioGroupItem value={v} id={`rehire_${v}`} />
                                                        <Label htmlFor={`rehire_${v}`}>{l}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                            {errors.would_rehire && <p className="text-destructive text-xs">{errors.would_rehire}</p>}
                                        </div>
                                    </div>
                                )}

                                {/* Step nav */}
                                <div className="flex items-center justify-between border-t pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={step === 1}
                                        onClick={() => setStep((s) => s - 1)}
                                        className="gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Back
                                    </Button>
                                    {step < TOTAL_STEPS ? (
                                        <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
                                            Next <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button type="button" size="sm" disabled={submitting} onClick={handleSubmit}>
                                            {submitting ? 'Submitting…' : 'Submit Reference Check'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function ReadOnlyRefCheck({
    check,
    ref_,
    occupationDisplay,
}: {
    check: ReferenceCheckData;
    ref_: Reference;
    occupationDisplay: string;
}) {
    const perfLabel = (v: string | null) => PERF_OPTIONS.find((o) => o.value === v)?.label ?? v ?? '—';
    const capitalize = (v: string | null) => v ? v.charAt(0).toUpperCase() + v.slice(1) : '—';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Reference check completed</span>
                {check.completed_at && (
                    <span className="text-muted-foreground text-xs ml-auto">
                        {new Date(check.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {check.completed_by_user && ` · ${check.completed_by_user.name}`}
                    </span>
                )}
            </div>

            <div className="grid gap-4">
                <RCField label="Referee" value={ref_.contact_person} />
                <RCField label="Position Applied For" value={occupationDisplay} />
                <RCField label="Current Job Title" value={check.referee_current_job_title} />
                <RCField label="Current Employer" value={check.referee_current_employer} />
                <RCField label="Telephone" value={check.telephone} />
                <RCField label="Email" value={check.email} />
                <RCField label="Prepared to Provide Reference" value={check.prepared_to_provide_reference === null ? '—' : check.prepared_to_provide_reference ? 'Yes' : 'No'} />
            </div>

            <Separator />

            <div className="grid gap-4">
                <RCField label="Employed From" value={check.employment_from ? new Date(check.employment_from).toLocaleDateString('en-AU') : null} />
                <RCField label="Employed To" value={check.employment_to ? new Date(check.employment_to).toLocaleDateString('en-AU') : null} />
                <RCField label="Dates Align with Job Enquiry" value={check.dates_align === null ? '—' : check.dates_align ? 'Yes' : 'No'} />
                <RCField label="Relationship to Applicant" value={check.relationship} />
                <RCField label="Duration" value={check.relationship_duration} />
                <RCField label="Company at Time" value={check.company_at_time} />
                <RCField label="Job Title" value={
                    check.applicant_job_title === 'other' && check.applicant_job_title_other
                        ? check.applicant_job_title_other
                        : check.applicant_job_title ? capitalize(check.applicant_job_title) : null
                } />
            </div>

            {check.duties && check.duties.length > 0 && (
                <div className="grid gap-1">
                    <span className="text-muted-foreground text-xs font-medium">Duties</span>
                    <div className="flex flex-wrap gap-1.5">
                        {check.duties.map((d) => <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>)}
                    </div>
                </div>
            )}

            <Separator />

            <div className="grid gap-4">
                <RCField label="Overall Performance" value={perfLabel(check.performance_rating)} />
                <RCField label="Honest &amp; Good Work Ethic" value={perfLabel(check.honest_work_ethic)} />
                <RCField label="Punctual / Attendance" value={capitalize(check.punctual)} />
                <RCField label="Takes Many Sick Days" value={capitalize(check.sick_days)} />
                <RCField label="Reason for Leaving" value={check.reason_for_leaving} />
            </div>

            <Separator />

            <div className="grid gap-4">
                <RCField label="Greatest Strengths" value={check.greatest_strengths} />
                <RCField label="Would Re-hire" value={capitalize(check.would_rehire)} />
            </div>

            <Separator />

            <div className="grid gap-4">
                <RCField label="Completed By" value={check.completed_by_name} />
                <RCField label="Position" value={check.completed_by_position} />
                <RCField label="Date" value={check.completed_date ? new Date(check.completed_date).toLocaleDateString('en-AU') : null} />
            </div>
        </div>
    );
}

// ─── Send to Payroll Modal ──────────────────────────────────────────────────────

function SendToPayrollModal({ open, onOpenChange, application, locations }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    application: Application;
    locations: Record<string, OnboardingLocation[]>;
}) {
    const [selectedLocation, setSelectedLocation] = useState('');
    const [qualificationsRequired, setQualificationsRequired] = useState(false);
    const [emergencyContactRequired, setEmergencyContactRequired] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    function handleSubmit() {
        if (!selectedLocation) {
            setError('Please select a location.');
            return;
        }
        setProcessing(true);
        setError('');

        router.post(route('employment-applications.onboard', application.id), {
            eh_location_id: selectedLocation,
            qualifications_required: qualificationsRequired,
            emergency_contact_required: emergencyContactRequired,
        }, {
            onSuccess: () => {
                setProcessing(false);
                onOpenChange(false);
                setSelectedLocation('');
            },
            onError: (errors) => {
                setProcessing(false);
                setError(errors.onboard || errors.eh_location_id || 'Something went wrong.');
            },
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send to Payroll</DialogTitle>
                    <DialogDescription>
                        Send a self-service onboarding invite to <strong>{application.first_name} {application.surname}</strong>. They will receive an email to complete their TFN, super, and bank details.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Read-only applicant details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <Label className="text-muted-foreground text-xs">Name</Label>
                            <p className="font-medium">{application.first_name} {application.surname}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Email</Label>
                            <p className="font-medium">{application.email}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Phone</Label>
                            <p className="font-medium">{application.phone}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Occupation</Label>
                            <p className="font-medium capitalize">{application.occupation === 'other' && application.occupation_other ? application.occupation_other : application.occupation}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Location selector */}
                    <div className="space-y-1.5">
                        <Label htmlFor="onboard-location">Location <span className="text-red-500">*</span></Label>
                        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                            <SelectTrigger id="onboard-location">
                                <SelectValue placeholder="Select a location..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(locations).map(([company, locs]) => (
                                    <div key={company}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{company}</div>
                                        {locs.map((loc) => (
                                            <SelectItem key={loc.eh_location_id} value={loc.eh_location_id}>
                                                {loc.name}
                                            </SelectItem>
                                        ))}
                                    </div>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="emergency-contact"
                                checked={emergencyContactRequired}
                                onCheckedChange={(checked) => setEmergencyContactRequired(checked === true)}
                            />
                            <Label htmlFor="emergency-contact" className="text-sm font-normal">Require emergency contact details</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="qualifications"
                                checked={qualificationsRequired}
                                onCheckedChange={(checked) => setQualificationsRequired(checked === true)}
                            />
                            <Label htmlFor="qualifications" className="text-sm font-normal">Require qualifications</Label>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={processing}>
                        {processing ? (
                            <>
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            'Send to Payroll'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EmploymentApplicationShow({ application: app, comments, checklists, availableTemplates, duplicates, signingRequests, documentTemplates, formTemplates, formRequests, onboardingLocations, screeningAlert }: PageProps) {
    const pageProps = usePage<{ auth: { permissions?: string[]; isAdmin?: boolean; user?: { id: number; name: string } }; errors: Record<string, string> }>().props;
    const { auth, errors: pageErrors } = pageProps;
    const permissions = auth.permissions ?? [];
    const canView = auth.isAdmin || permissions.includes('employment-applications.view');
    const canScreen = auth.isAdmin || permissions.includes('employment-applications.screen');
    const canApprove = auth.isAdmin || permissions.includes('employment-applications.approve');

    const [showDeclineDialog, setShowDeclineDialog] = useState(false);
    const [showSigningModal, setShowSigningModal] = useState(false);
    const [showOnboardModal, setShowOnboardModal] = useState(false);

    // Reference check dialog
    const [refCheckOpen, setRefCheckOpen] = useState(false);
    const [refCheckInitialRefId, setRefCheckInitialRefId] = useState<number | null>(null);

    function openRefCheckDialog(referenceId?: number | null) {
        setRefCheckInitialRefId(referenceId ?? null);
        setRefCheckOpen(true);
    }
    const [commentBody, setCommentBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(undefined);

    // Comment edit/delete state
    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editBody, setEditBody] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

    // Comment filter & sort
    const [commentFilter, setCommentFilter] = useState<'all' | 'messages' | 'attachments' | 'history'>('all');
    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');

    const currentUser = (usePage().props.auth as { user?: { id: number; name: string } })?.user;
    const currentUserId = currentUser?.id;
    const currentUserName = currentUser?.name ?? '';

    const declineForm = useForm({ reason: '' });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Applications', href: '/employment-applications' },
        { title: `${app.first_name} ${app.surname}`, href: `/employment-applications/${app.id}` },
    ];

    const occupationDisplay = app.occupation === 'other' && app.occupation_other ? app.occupation_other : app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);

    function handleStatusChange(newStatus: string) {
        if (newStatus === app.status) return;
        router.patch(route('employment-applications.update-status', app.id), { status: newStatus }, {
            preserveScroll: true,
        });
    }

    function handleDecline() {
        declineForm.post(route('employment-applications.decline', app.id), {
            preserveScroll: true,
            onSuccess: () => setShowDeclineDialog(false),
        });
    }

    function handlePostComment() {
        if (!commentBody.trim() && attachments.length === 0) return;

        const formData = new FormData();
        formData.append('commentable_type', 'employment_application');
        formData.append('commentable_id', String(app.id));
        formData.append('body', commentBody);
        attachments.forEach((file) => formData.append('attachments[]', file));

        setSubmitting(true);
        router.post(route('comments.store'), formData, {
            preserveScroll: true,
            onSuccess: () => {
                setCommentBody('');
                setAttachments([]);
            },
            onFinish: () => setSubmitting(false),
        });
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
        }
        e.target.value = '';
    }

    function removeAttachment(index: number) {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }

    function handleEditComment(comment: CommentData) {
        setEditingComment(comment);
        setEditBody(comment.body);
    }

    function handleSaveEdit() {
        if (!editingComment || !editBody.trim()) return;
        setEditSaving(true);
        router.patch(route('comments.update', editingComment.id), { body: editBody }, {
            preserveScroll: true,
            onSuccess: () => setEditingComment(null),
            onFinish: () => setEditSaving(false),
        });
    }

    function handleDeleteComment(commentId: number) {
        setDeletingCommentId(commentId);
    }

    function confirmDelete() {
        if (deletingCommentId === null) return;
        setDeleteProcessing(true);
        router.delete(route('comments.destroy', deletingCommentId), {
            preserveScroll: true,
            onSuccess: () => setDeletingCommentId(null),
            onFinish: () => setDeleteProcessing(false),
        });
    }

    // Compute filtered & sorted comments
    const filteredComments = (() => {
        let result = comments;
        if (commentFilter === 'messages') {
            result = result.filter((c) => c.metadata === null && c.attachments.length === 0);
        } else if (commentFilter === 'attachments') {
            result = result.filter((c) => c.attachments.length > 0);
        } else if (commentFilter === 'history') {
            result = result.filter((c) => c.metadata !== null);
        }
        if (commentSort === 'newest') {
            result = [...result].reverse();
        }
        return result;
    })();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${app.first_name} ${app.surname} — Application`} />

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 sm:p-4">
                {/* Banners */}
                {duplicates.length > 0 && (
                    <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-700 dark:text-amber-400">Duplicate Applicant</AlertTitle>
                        <AlertDescription className="text-amber-600 dark:text-amber-300">
                            {duplicates.length} other application(s):
                            {duplicates.map((d) => (
                                <Link key={d.id} href={`/employment-applications/${d.id}`} className="ml-2 underline">
                                    {STATUS_LABELS[d.status] ?? d.status} ({formatDate(d.created_at)})
                                </Link>
                            ))}
                        </AlertDescription>
                    </Alert>
                )}

                {screeningAlert && (permissions.includes('worker-screening.search') || auth.isAdmin) && (
                    <Alert className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-700 dark:text-red-400">Worker Alert</AlertTitle>
                        <AlertDescription className="text-red-600 dark:text-red-300">
                            Worker alert on file — contact office before proceeding.
                        </AlertDescription>
                    </Alert>
                )}

                {app.status === 'declined' && (
                    <Alert className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
                        <XIcon className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-700 dark:text-red-400">Application Declined</AlertTitle>
                        <AlertDescription className="text-red-600 dark:text-red-300">
                            {app.declined_by_user && <>by {app.declined_by_user.name} on {formatDate(app.declined_at)}</>}
                            {app.declined_reason && <> — {app.declined_reason}</>}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Single Card Layout */}
                <Card className="gap-0 overflow-hidden rounded-xl py-0 lg:min-h-[calc(100vh-7rem)]">
                    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
                        {/* Left Column — Main Content */}
                        <div className="flex flex-col">
                            <div className="flex-1 space-y-6 p-5">
                                {/* Checklist Section */}
                                <ChecklistSection
                                    checklists={checklists}
                                    availableTemplates={availableTemplates}
                                    applicationId={app.id}
                                    canScreen={canScreen}
                                />

                                {/* Activity Header */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold">Activity</h3>
                                    </div>
                                    {comments.length > 0 && (
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="text-muted-foreground">Show:</span>
                                                <Select value={commentFilter} onValueChange={(v) => setCommentFilter(v as 'all' | 'messages' | 'attachments' | 'history')}>
                                                    <SelectTrigger className="h-7 w-auto gap-1 border-0 px-2 text-xs shadow-none">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All</SelectItem>
                                                        <SelectItem value="messages">Messages</SelectItem>
                                                        <SelectItem value="attachments">Attachments</SelectItem>
                                                        <SelectItem value="history">History</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <button
                                                type="button"
                                                className="text-primary flex items-center gap-1 text-xs font-medium"
                                                onClick={() => setCommentSort((s) => (s === 'oldest' ? 'newest' : 'oldest'))}
                                            >
                                                {commentSort === 'oldest' ? 'Oldest first' : 'Newest first'}
                                                <ArrowRight className={cn('h-3 w-3 transition-transform', commentSort === 'oldest' ? 'rotate-[-90deg]' : 'rotate-90')} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Comments */}
                                {comments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No activity yet. Post a comment to get started.
                                    </p>
                                ) : filteredComments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No {commentFilter === 'attachments' ? 'attachments' : commentFilter === 'history' ? 'history' : 'messages'} found.
                                    </p>
                                ) : (
                                    filteredComments.map((comment) => (
                                        <CommentBubble
                                            key={comment.id}
                                            comment={comment}
                                            currentUserId={currentUserId}
                                            onEdit={handleEditComment}
                                            onDelete={handleDeleteComment}
                                            onOpenRefCheck={openRefCheckDialog}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Comment Input */}
                            {canView && (
                                <div className="mt-auto border-t p-3">
                                    {attachments.length > 0 && (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {attachments.map((file, i) => (
                                                <div key={i} className="bg-muted flex items-center gap-1.5 rounded px-2 py-1 text-xs">
                                                    <FileIcon className="h-3 w-3" />
                                                    <span className="max-w-[120px] truncate">{file.name}</span>
                                                    <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                                                        <XCircle className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-end gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" type="button">
                                                    <Paperclip className="h-4 w-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-44 p-1.5" side="top" align="start">
                                                <button
                                                    type="button"
                                                    className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Paperclip className="h-3.5 w-3.5" />
                                                    Attach file
                                                </button>
                                                {app.references.length > 0 && (
                                                    <button
                                                        type="button"
                                                        className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm"
                                                        onClick={() => openRefCheckDialog()}
                                                    >
                                                        <ClipboardList className="h-3.5 w-3.5" />
                                                        Reference check
                                                    </button>
                                                )}
                                            </PopoverContent>
                                        </Popover>
                                        <Textarea
                                            placeholder="Enter message here..."
                                            className="min-h-[40px] flex-1 resize-none"
                                            rows={1}
                                            value={commentBody}
                                            onChange={(e) => setCommentBody(e.target.value)}
                                            onFocus={() => setInputFocused(true)}
                                            onBlur={() => setInputFocused(false)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                    e.preventDefault();
                                                    handlePostComment();
                                                }
                                            }}
                                        />
                                        {inputFocused || commentBody.trim() || attachments.length > 0 ? (
                                            <Button
                                                size="icon"
                                                className="h-10 w-10 shrink-0"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={handlePostComment}
                                                disabled={submitting || (!commentBody.trim() && attachments.length === 0)}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5">
                                                        <Share2 className="h-3.5 w-3.5" />
                                                        Share
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-1.5" side="top" align="end">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 gap-1.5"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(window.location.href);
                                                            setLinkCopied(true);
                                                            setTimeout(() => setLinkCopied(false), 2000);
                                                        }}
                                                    >
                                                        {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                                                        {linkCopied ? 'Copied!' : 'Copy link'}
                                                    </Button>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column — Attributes Sidebar */}
                        <div className="bg-muted/40 p-5 max-lg:border-t lg:border-l">
                                {/* Name & Status */}
                                <div className="mb-4 flex items-start justify-between gap-2">
                                    <h2 className="text-lg font-semibold">
                                        {app.first_name} {app.surname}
                                    </h2>
                                    <StatusBadge status={app.status} />
                                </div>

                                {/* Status Controls */}
                                {canScreen && (
                                    <div className="mb-4 space-y-2">
                                        {SYSTEM_STATUSES.includes(app.status) ? (
                                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                                                <StatusBadge status={app.status} />
                                                <span className="text-xs">(system)</span>
                                            </div>
                                        ) : (
                                            <Select value={app.status} onValueChange={handleStatusChange}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Change status..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SELECTABLE_STATUSES.filter((s) => s !== 'approved' || canApprove).map((s) => (
                                                        <SelectItem key={s} value={s}>
                                                            {STATUS_LABELS[s]}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {pageErrors.status && (
                                            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{pageErrors.status}</p>
                                        )}

                                        {/* Action Buttons — contextual based on current status */}
                                        <div className="flex gap-2">
                                            {['approved', 'contract_sent', 'contract_signed'].includes(app.status) && (
                                                <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowSigningModal(true)}>
                                                    <Send className="mr-1.5 h-3.5 w-3.5" />
                                                    Send Docs
                                                </Button>
                                            )}
                                            {['contract_signed', 'onboarded'].includes(app.status) && (
                                                <Button size="sm" variant="default" className="flex-1" onClick={() => setShowOnboardModal(true)}>
                                                    <User className="mr-1.5 h-3.5 w-3.5" />
                                                    Payroll
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Pending Signing Requests — only show unsigned docs */}
                                {signingRequests.filter((sr) => sr.status !== 'signed').length > 0 && (
                                    <div className="mb-4 rounded-lg border bg-background p-3">
                                        <span className="mb-2 block text-xs font-medium text-muted-foreground">Pending Documents</span>
                                        <div className="space-y-2">
                                            {signingRequests.filter((sr) => sr.status !== 'signed').map((sr) => (
                                                <div key={sr.id} className="rounded-md border p-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="truncate text-sm font-medium">{sr.document_template?.name ?? 'Document'}</p>
                                                        <Badge variant="secondary" className="shrink-0 text-xs">{sr.status}</Badge>
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {sr.delivery_method === 'email' ? 'Via email' : 'In-person'}
                                                        {sr.sent_by && ` by ${sr.sent_by.name}`}
                                                    </p>
                                                    {canScreen && (
                                                        <div className="mt-1.5 flex gap-1.5">
                                                            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => router.post(route('signing-requests.resend', sr.id), {}, { preserveScroll: true })}>
                                                                Resend
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs text-destructive" onClick={() => router.post(route('signing-requests.cancel', sr.id), {}, { preserveScroll: true })}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pending Form Requests — only show unsubmitted forms */}
                                {formRequests.filter((fr) => fr.status !== 'submitted').length > 0 && (
                                    <div className="mb-4 rounded-lg border bg-background p-3">
                                        <span className="mb-2 block text-xs font-medium text-muted-foreground">Pending Forms</span>
                                        <div className="space-y-2">
                                            {formRequests.filter((fr) => fr.status !== 'submitted').map((fr) => (
                                                <div key={fr.id} className="rounded-md border p-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="truncate text-sm font-medium">{fr.form_template?.name ?? 'Form'}</p>
                                                        <Badge variant="secondary" className="shrink-0 text-xs">{fr.status}</Badge>
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {fr.delivery_method === 'email' ? 'Via email' : 'In-person'}
                                                        {fr.sent_by && ` by ${fr.sent_by.name}`}
                                                    </p>
                                                    {canScreen && (
                                                        <div className="mt-1.5 flex gap-1.5">
                                                            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => router.post(route('form-requests.resend', fr.id), {}, { preserveScroll: true })}>
                                                                Resend
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs text-destructive" onClick={() => router.post(route('form-requests.cancel', fr.id), {}, { preserveScroll: true })}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Separator className="mb-2" />

                                {/* Personal Details */}
                                <div className="divide-y">
                                    <SidebarAttribute icon={MapPin} label="Suburb">
                                        {app.suburb}
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={Mail} label="Email">
                                        <a href={`mailto:${app.email}`} className="text-primary hover:underline">{app.email}</a>
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={Phone} label="Phone">
                                        <a href={`tel:${app.phone}`} className="text-primary hover:underline">{app.phone}</a>
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={Calendar} label="Date of Birth">
                                        {formatDate(app.date_of_birth)}
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={User} label="Why Should We Employ You?">
                                        <p className="text-sm whitespace-pre-wrap">{app.why_should_we_employ_you || '—'}</p>
                                    </SidebarAttribute>

                                    {app.referred_by && (
                                        <SidebarAttribute icon={User} label="Referred By">
                                            {app.referred_by}
                                        </SidebarAttribute>
                                    )}

                                    <SidebarAttribute icon={User} label="Aboriginal / TSI">
                                        {app.aboriginal_or_tsi === null ? '—' : app.aboriginal_or_tsi ? 'Yes' : 'No'}
                                    </SidebarAttribute>
                                </div>

                                <Separator className="my-2" />

                                {/* Occupation */}
                                <div className="divide-y">
                                    <SidebarAttribute icon={Wrench} label="Occupation">
                                        <span>{occupationDisplay}</span>
                                        {app.trade_qualified && <Badge variant="secondary" className="ml-1.5 text-[10px]">Trade Qualified</Badge>}
                                    </SidebarAttribute>

                                    {app.apprentice_year && (
                                        <SidebarAttribute icon={Calendar} label="Apprentice Year">
                                            Year {app.apprentice_year}
                                        </SidebarAttribute>
                                    )}
                                </div>

                                {/* Skills */}
                                {app.skills.length > 0 && (
                                    <>
                                        <Separator className="my-2" />
                                        <div className="py-2">
                                            <p className="text-muted-foreground mb-2 text-xs">Skills</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {app.skills.map((s) => (
                                                    <Badge key={s.id} variant={s.is_custom ? 'outline' : 'secondary'} className="text-[10px]">
                                                        {s.skill_name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <Separator className="my-2" />

                                {/* View Full Submission Link */}
                                <Link
                                    href={`/employment-applications/${app.id}/submission`}
                                    className="text-primary mt-2 flex items-center gap-1.5 py-2 text-sm font-medium hover:underline"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    View Full Submission
                                    <ChevronRight className="ml-auto h-3.5 w-3.5" />
                                </Link>

                                {canScreen && app.status !== 'declined' && app.status !== 'onboarded' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeclineDialog(true)}
                                        className="mt-1 flex items-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-destructive"
                                    >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Decline Application
                                    </button>
                                )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Reference Check Dialog */}
            <ReferenceCheckDialog
                open={refCheckOpen}
                onClose={() => setRefCheckOpen(false)}
                application={app}
                initialReferenceId={refCheckInitialRefId}
                authUserName={currentUserName}
            />

            {/* Decline Dialog */}
            <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Decline Application</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to decline {app.first_name} {app.surname}'s application?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="decline_reason">Reason (optional)</Label>
                        <Textarea
                            id="decline_reason"
                            value={declineForm.data.reason}
                            onChange={(e) => declineForm.setData('reason', e.target.value)}
                            placeholder="Enter reason for declining..."
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDecline} disabled={declineForm.processing}>
                            {declineForm.processing ? 'Declining...' : 'Decline'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Comment Dialog */}
            <Dialog open={editingComment !== null} onOpenChange={(open) => { if (!open) setEditingComment(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Comment</DialogTitle>
                        <DialogDescription>Update your comment below.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        className="resize-none"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={editSaving || !editBody.trim()}>
                            {editSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Comment Confirmation */}
            <Dialog open={deletingCommentId !== null} onOpenChange={(open) => { if (!open) setDeletingCommentId(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Comment</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this comment? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingCommentId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleteProcessing}>
                            {deleteProcessing ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Send for Signing Modal */}
            <SendForSigningModal
                open={showSigningModal}
                onOpenChange={setShowSigningModal}
                templates={documentTemplates ?? []}
                formTemplates={formTemplates ?? []}
                recipientName={`${app.first_name} ${app.surname}`}
                recipientEmail={app.email}
                recipientAddress={app.suburb}
                recipientPhone={app.phone}
                recipientPosition={app.occupation === 'other' && app.occupation_other ? app.occupation_other : app.occupation}
                signableType="App\Models\EmploymentApplication"
                signableId={app.id}
            />

            {/* Send to Payroll Modal */}
            <SendToPayrollModal
                open={showOnboardModal}
                onOpenChange={setShowOnboardModal}
                application={app}
                locations={onboardingLocations ?? {}}
            />

        </AppLayout>
    );
}

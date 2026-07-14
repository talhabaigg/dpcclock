import SendForSigningModal from '@/components/signing/send-for-signing-modal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import { CommentBody, type MentionedUser } from '@/components/comments/comment-body';
import type { JSONContent } from '@tiptap/react';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Calendar,
    Check,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Clipboard,
    Download,
    EllipsisVertical,
    ExternalLink,
    FileIcon,
    FileText,
    History,
    ListChecks,
    Loader2,
    Lock,
    Mail,
    MapPin,
    MessageSquare,
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
    UserCheck,
    Reply,
    RotateCcw,
    Trash,
    XCircle,
    XIcon,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    FormFillPane,
    FormResponsePane,
    type FormRequestData,
} from '@/components/form-renderer/form-fill-pane';

import SubmissionContent from '@/components/employment-applications/submission-content';

const ApplicantMiniMap = lazy(() => import('@/components/employment-applications/applicant-mini-map'));

interface Skill {
    id: number;
    skill_name: string;
    is_custom: boolean;
}

interface Reference {
    id: number;
    sort_order: number;
    company_name: string;
    position: string;
    employment_period: string;
    contact_person: string;
    phone_number: string;
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
    body_json?: import('@tiptap/react').JSONContent | null;
    metadata: Record<string, unknown> | null;
    user: UserModel | null;
    created_at: string;
    mentioned_users?: MentionedUser[];
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
    address: string | null;
    state: string | null;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
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
    employees: { id: number; name: string; eh_employee_id: string | null }[];
    skills: Skill[];
    references: Reference[];
    screening_interview: { id: number } | null;
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

interface InjuryHistoryItem {
    id: number;
    id_formal: string | null;
    occurred_at: string | null;
    incident_label: string | null;
    description: string | null;
    work_cover_claim: boolean;
    claim_status: string | null;
    work_days_missed: number | null;
    days_suitable_duties: number | null;
    report_type_label: string | null;
    locked_at: string | null;
}

interface InjuryHistory {
    employee: { id: number; name: string; is_archived: boolean };
    injuries: InjuryHistoryItem[];
}

interface AvailableOnDemandForm {
    id: number;
    form_template_id: number;
    form_template_name: string | null;
    subject_source: string | null;
    min_submissions: number;
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
    availableOnDemandForms?: AvailableOnDemandForm[];
    onboardingLocations: Record<string, OnboardingLocation[]>;
    statuses: Record<string, string>;
    screeningAlert?: boolean;
    injuryHistory?: InjuryHistory | null;
}

const PIPELINE_STATUSES = ['new', 'reviewing', 'phone_interview', 'reference_check', 'face_to_face', 'whs_review', 'final_review', 'approved', 'contract_sent', 'contract_signed', 'onboarded'];

/** Statuses set only by the system (signing service, event listeners, onboarding) — not user-selectable */
const SYSTEM_STATUSES = ['contract_sent', 'contract_signed', 'onboarded'];

/** Statuses that are selectable in the dropdown */
const SELECTABLE_STATUSES = PIPELINE_STATUSES.filter((s) => !SYSTEM_STATUSES.includes(s));

/** Early-pipeline statuses owned by the screen permission (up to face-to-face). */
const SCREEN_STATUSES = ['new', 'reviewing', 'phone_interview', 'reference_check', 'face_to_face'];

function StatusBadge({ status, labels, className }: { status: string; labels: Record<string, string>; className?: string }) {
    return (
        <Badge variant="secondary" className={cn('text-xs', className)}>
            {labels[status] ?? status}
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
        <div className="flex items-start gap-2 py-1.5 leading-tight">
            <Icon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[11px]">{label}</p>
                <div className="text-xs">{children}</div>
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
            <AvatarFallback className="bg-muted text-primary text-xs font-medium">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

function CommentBubble({ comment, currentUserId, onEdit, onDelete, onOpenFormResponse, onReply, isReply, statusLabels, formRequestsById }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
    onOpenFormResponse?: (formRequestId: number) => void;
    onReply?: (commentId: number, userName: string, userId: number | null) => void;
    isReply?: boolean;
    statusLabels: Record<string, string>;
    formRequestsById?: Map<number, FormRequestData>;
}) {
    const [showReplies, setShowReplies] = useState(false);
    const isSystem = comment.metadata !== null;
    const statusChange = comment.metadata?.status_change as { from: string; to: string } | undefined;
    const contractSignedMeta = comment.metadata?.type === 'contract_signed' ? comment.metadata as { type: string; signing_request_id: number } : undefined;
    const formSubmittedMeta = comment.metadata?.type === 'form_submitted' ? comment.metadata as { type: string; form_request_id: number; form_name: string } : undefined;
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
        const fr = formRequestsById?.get(formSubmittedMeta.form_request_id);
        const snapshot = fr?.response_snapshot ?? [];
        // Show the first 2 answered questions as a real Q&A preview inside
        // the thumbnail — like Drive's mini page render.
        const answered = snapshot.filter(
            (row) => row.type !== 'heading'
                && row.value_display !== null
                && row.value_display !== ''
                && !(Array.isArray(row.value_display) && row.value_display.length === 0),
        );
        const preview = answered.slice(0, 2);
        const answeredCount = answered.length;
        const recipient = fr?.recipient_name;

        return (
            <div className="flex gap-3">
                <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <Clipboard className="text-muted-foreground h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground"> {comment.body}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                    <button
                        type="button"
                        onClick={() => onOpenFormResponse?.(formSubmittedMeta.form_request_id)}
                        className="group mt-1.5 block w-52 overflow-hidden rounded-md border bg-background text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
                    >
                        {/* Fake page preview — mini render of the response */}
                        <div className="relative h-24 overflow-hidden border-b bg-white p-2 dark:bg-slate-950">
                            <p className="mb-1.5 truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {formSubmittedMeta.form_name}
                            </p>
                            {preview.length > 0 ? (
                                <div className="space-y-1.5">
                                    {preview.map((row) => (
                                        <div key={row.field_id} className="leading-tight">
                                            <p className="truncate text-[8px] text-muted-foreground">{row.label}</p>
                                            <p className="truncate text-[10px] font-medium text-foreground">
                                                {Array.isArray(row.value_display) ? row.value_display.join(', ') : row.value_display}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1 pt-1">
                                    <div className="h-1 w-4/5 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    <div className="h-1 w-3/5 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    <div className="h-1 w-2/3 rounded-full bg-slate-200 dark:bg-slate-800" />
                                </div>
                            )}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent dark:from-slate-950" />
                        </div>
                        {/* Footer bar — Drive-style file row */}
                        <div className="flex items-center gap-1.5 px-2 py-1.5">
                            <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <div className="min-w-0 leading-tight">
                                <p className="truncate text-[11px] font-medium">{formSubmittedMeta.form_name}</p>
                                <p className="truncate text-[9px] text-muted-foreground">
                                    {recipient ?? 'Response'}{answeredCount > 0 ? ` · ${answeredCount} answer${answeredCount === 1 ? '' : 's'}` : ''}
                                </p>
                            </div>
                        </div>
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
                        <StatusBadge status={statusChange.from} labels={statusLabels} className="mx-0.5" />
                        <ArrowRight className="mx-0.5 inline h-3 w-3" />
                        <StatusBadge status={statusChange.to} labels={statusLabels} className="mx-0.5" />
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDateTime(comment.created_at)}</p>
                </div>
            </div>
        );
    }

    const hasReplies = comment.replies && comment.replies.length > 0;
    const replyCount = comment.replies?.length ?? 0;

    return (
        <div className={cn('group/comment', !isReply && 'pb-1')}>
            <div className={cn('flex gap-3', isReply && 'gap-2.5')}>
                {comment.user ? (
                    <UserAvatar name={comment.user.name} className={isReply ? 'h-6 w-6 text-[10px]' : undefined} />
                ) : (
                    <div className={cn(
                        'flex shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800',
                        isReply ? 'h-6 w-6' : 'h-8 w-8'
                    )}>
                        <ArrowRight className={cn(isReply ? 'h-3 w-3' : 'h-4 w-4', 'text-slate-500')} />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className={cn('leading-tight', isReply ? 'text-xs' : 'text-sm')}>
                            <span className="font-semibold">{comment.user?.name ?? 'System'}</span>
                            <span className="text-muted-foreground ml-2 text-xs font-normal">{formatDateTime(comment.created_at)}</span>
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
                                        variant="secondary"
                                        className="h-8 gap-1.5"
                                        onClick={() => onEdit?.(comment)}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => onDelete?.(comment.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </Button>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                    {(comment.body_json || comment.body) && (
                        <CommentBody
                            doc={comment.body_json}
                            fallback={comment.body}
                            mentionedUsers={comment.mentioned_users}
                            className={cn('mt-0.5 whitespace-pre-wrap', isReply ? 'text-xs' : 'text-sm')}
                        />
                    )}
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
                    {!isSystem && !isReply && onReply && (
                        <div className="mt-1 flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => onReply(comment.id, comment.user?.name ?? 'someone', comment.user?.id ?? null)}
                                className="text-muted-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors"
                            >
                                <Reply className="h-3.5 w-3.5" />
                                Reply
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* YouTube-style collapsible replies */}
            {hasReplies && !isReply && (
                <div className="ml-11 mt-0.5">
                    <button
                        type="button"
                        onClick={() => setShowReplies(!showReplies)}
                        className="text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
                    >
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showReplies && 'rotate-180')} />
                        {showReplies ? 'Hide' : `${replyCount}`} {replyCount === 1 ? 'reply' : 'replies'}
                    </button>
                    {showReplies && (
                        <div className="mt-1 space-y-2.5 border-l-2 border-border/50 pl-3">
                            {comment.replies!.map((reply) => (
                                <CommentBubble key={reply.id} comment={reply} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} statusLabels={statusLabels} formRequestsById={formRequestsById} isReply />
                            ))}
                        </div>
                    )}
                </div>
            )}
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
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">Checklists</h3>
                        {totalItems > 0 && (
                            <span className="text-muted-foreground text-xs whitespace-nowrap">
                                {completedItems}/{totalItems}
                                {requiredIncomplete > 0 && (
                                    <span className="ml-1 text-amber-600">({requiredIncomplete} required remaining)</span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {checklists.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground whitespace-nowrap"
                                    onClick={() => setCollapsedChecklists(new Set())}
                                >
                                    Expand all
                                </button>
                                <span className="text-muted-foreground/50">|</span>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground whitespace-nowrap"
                                    onClick={() => setCollapsedChecklists(new Set(checklists.map((c) => c.id)))}
                                >
                                    Collapse all
                                </button>
                            </>
                        )}
                        {canScreen && (
                            <button
                                type="button"
                                className="text-primary flex items-center gap-1 whitespace-nowrap text-xs hover:underline"
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
                                        className="text-primary flex items-center gap-1 whitespace-nowrap text-xs hover:underline"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add checklist
                                        <ChevronDown className="h-3 w-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-auto">
                                    <DropdownMenuItem onClick={() => setShowAddChecklist(true)} className="whitespace-nowrap">
                                        <ListChecks className="mr-2 h-3.5 w-3.5" />
                                        Create new checklist
                                    </DropdownMenuItem>
                                    {availableTemplates.length > 0 ? (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="whitespace-nowrap">
                                                <Plus className="mr-2 h-3.5 w-3.5" />
                                                Add existing checklist
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="w-auto">
                                                {availableTemplates.map((t) => (
                                                    <DropdownMenuItem key={t.id} onClick={() => handleAttachTemplate(String(t.id))} className="whitespace-nowrap">
                                                        {t.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    ) : (
                                        <DropdownMenuItem disabled className="whitespace-nowrap">
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

export default function EmploymentApplicationShow({ application: app, comments, checklists, availableTemplates, duplicates, signingRequests, documentTemplates, formTemplates, formRequests, availableOnDemandForms, onboardingLocations, statuses, screeningAlert, injuryHistory }: PageProps) {
    const pageProps = usePage<{
        auth: { permissions?: string[]; isAdmin?: boolean; user?: { id: number; name: string } };
        errors: Record<string, string>;
        flash: { success?: string; info?: string; error?: string };
    }>().props;
    const { auth, errors: pageErrors, flash } = pageProps;
    const permissions = auth.permissions ?? [];

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.info) toast.info(flash.info);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.info, flash?.error]);

    // Permission-assigned forms can be filled by anyone holding the permission
    // (directly or through any of their roles). Senior roles cover juniors as
    // long as their permission grants overlap.
    function canFillFormRequest(fr: FormRequestData): boolean {
        if (app.status === 'onboarded') return false;
        if (auth.isAdmin) return true;
        if (fr.assignee_strategy === 'permission' && fr.assignee_permission) {
            return permissions.includes(fr.assignee_permission);
        }
        // User-assigned / email-recipient forms — fall back to the standard screening permission.
        return permissions.includes('employment-applications.screen');
    }
    const canView = auth.isAdmin || permissions.includes('employment-applications.view');
    // Once onboarded, the enquiry becomes a historical record — the employee
    // lives in payroll now, so mutating this record risks drifting from the
    // source of truth. Comments stay open so HR can still leave notes.
    const isLocked = app.status === 'onboarded';
    const hasScreen = auth.isAdmin || permissions.includes('employment-applications.screen');
    const hasWhsReview = auth.isAdmin || permissions.includes('employment-applications.whs-review');
    const hasWhs = auth.isAdmin || permissions.includes('employment-applications.whs');
    const hasApprove = auth.isAdmin || permissions.includes('employment-applications.approve');
    const canScreen = hasScreen && !isLocked;
    const canWhsReview = hasWhsReview && !isLocked;
    const canWhs = hasWhs && !isLocked;
    const canApprove = hasApprove && !isLocked;

    const [showDeclineDialog, setShowDeclineDialog] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [resetProcessing, setResetProcessing] = useState(false);
    const [showDeleteAppDialog, setShowDeleteAppDialog] = useState(false);
    const [deleteAppProcessing, setDeleteAppProcessing] = useState(false);
    const [deleteAppConfirmText, setDeleteAppConfirmText] = useState('');
    const [showSigningModal, setShowSigningModal] = useState(false);
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [showSubmissionPane, setShowSubmissionPane] = useState(false);
    const [fillingFormRequest, setFillingFormRequest] = useState<FormRequestData | null>(null);
    const [viewingFormRequest, setViewingFormRequest] = useState<FormRequestData | null>(null);

    // Deep-link from the dashboard: ?form_request=ID auto-opens the fill pane
    // so users land directly on the form they were sent to complete.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestedId = Number(params.get('form_request'));
        if (!requestedId || !formRequests) return;
        const target = formRequests.find((fr) => fr.id === requestedId);
        if (target && target.status !== 'submitted' && target.status !== 'cancelled' && canFillFormRequest(target)) {
            setFillingFormRequest(target);
        }
    }, []);

    const [commentDoc, setCommentDoc] = useState<JSONContent | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [alertMessage, setAlertMessage] = useState<{ type: 'error'; text: string } | null>(null);

    // Reply state — userId lets us auto-@mention the replied-to user on the new comment.
    const [replyingTo, setReplyingTo] = useState<{ id: number; userId: number | null; userName: string } | null>(null);

    const docHasContent = (doc: JSONContent | null) => {
        if (!doc) return false;
        return /"text"|"mention"/.test(JSON.stringify(doc));
    };

    /**
     * Click Reply → pre-fill the editor with an @mention of that user so they
     * get notified when the reply is posted (mention extension drives the
     * mentioned_users payload server-side).
     */
    function handleReplyClick(commentId: number, userName: string, userId: number | null) {
        setReplyingTo({ id: commentId, userId, userName });
        if (userId == null) return;
        setCommentDoc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        { type: 'mention', attrs: { id: userId, label: userName } },
                        { type: 'text', text: ' ' },
                    ],
                },
            ],
        });
    }

    // Comment edit/delete state
    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editDoc, setEditDoc] = useState<JSONContent | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

    // Comment filter & sort
    const [commentFilter, setCommentFilter] = useState<'all' | 'messages' | 'attachments' | 'history'>('messages');
    const [mobileView, setMobileView] = useState<'details' | 'activity'>('details');
    // Form responses and signed contracts carry reviewable content, so they
    // surface alongside chat in Messages and Attachments — not buried in History.
    const isContentBearingSystem = (c: CommentData) =>
        c.metadata?.type === 'form_submitted' || c.metadata?.type === 'contract_signed';
    const messageCount = comments.filter((c) => c.metadata === null || isContentBearingSystem(c)).length;
    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');

    const currentUser = (usePage().props.auth as { user?: { id: number; name: string } })?.user;
    const currentUserId = currentUser?.id;

    const declineForm = useForm({ reason: '', add_to_screening: false });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Enquiries', href: '/employment-applications' },
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

    function handleReset() {
        setResetProcessing(true);
        router.post(route('employment-applications.reset', app.id), {}, {
            preserveScroll: false,
            onFinish: () => {
                setResetProcessing(false);
                setShowResetDialog(false);
            },
        });
    }

    function handleDeleteApplication() {
        setDeleteAppProcessing(true);
        router.delete(route('employment-applications.destroy', app.id), {
            onFinish: () => setDeleteAppProcessing(false),
        });
    }

    function handlePostComment() {
        if (!docHasContent(commentDoc) && attachments.length === 0) return;

        const formData = new FormData();
        formData.append('commentable_type', 'employment_application');
        formData.append('commentable_id', String(app.id));
        if (commentDoc) formData.append('body_json', JSON.stringify(commentDoc));
        if (replyingTo) formData.append('parent_id', String(replyingTo.id));
        attachments.forEach((file) => formData.append('attachments[]', file));

        setSubmitting(true);
        router.post(route('comments.store'), formData, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setCommentDoc(null);
                setAttachments([]);
                setReplyingTo(null);
            },
            onError: (errors) => {
                const msg = Object.values(errors).flat().join(', ');
                setAlertMessage({ type: 'error', text: msg || 'Failed to post comment.' });
            },
            onFinish: () => setSubmitting(false),
        });
    }

    function handleEditComment(comment: CommentData) {
        setEditingComment(comment);
        setEditDoc(comment.body_json ?? null);
    }

    function handleSaveEdit() {
        if (!editingComment || !docHasContent(editDoc)) return;
        setEditSaving(true);
        router.patch(
            route('comments.update', editingComment.id),
            { body_json: JSON.stringify(editDoc) },
            {
                preserveScroll: true,
                onSuccess: () => setEditingComment(null),
                onFinish: () => setEditSaving(false),
            },
        );
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

    // Lookup by id so form_submitted comment cards can render a preview of the
    // response without another round-trip.
    const formRequestsById = new Map((formRequests ?? []).map((fr) => [fr.id, fr]));

    // Compute filtered & sorted comments
    const filteredComments = (() => {
        let result = comments;
        if (commentFilter === 'messages') {
            result = result.filter((c) => c.metadata === null || isContentBearingSystem(c));
        } else if (commentFilter === 'attachments') {
            result = result.filter((c) => c.attachments.length > 0 || isContentBearingSystem(c));
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
            <Head title={`${app.first_name} ${app.surname} — Enquiry`} />

            <div
                className={cn(
                    'transition-[padding] duration-200',
                    // Side-by-side: form pane docked at right-0, submission shifted to right-[520px].
                    // Main content reserves space for both at xl+. Below xl the panes overlap as before.
                    showSubmissionPane && (fillingFormRequest || viewingFormRequest)
                        ? 'xl:pr-[1040px]'
                        : (showSubmissionPane || fillingFormRequest || viewingFormRequest) && 'xl:pr-[520px]',
                )}
            >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 sm:p-4">
                {alertMessage && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                            {alertMessage.text}
                            <button onClick={() => setAlertMessage(null)} className="ml-4 shrink-0">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Banners */}
                {duplicates.length > 0 && (
                    <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-700 dark:text-amber-400">Duplicate Candidate</AlertTitle>
                        <AlertDescription className="text-amber-600 dark:text-amber-300">
                            {duplicates.length} other enquiry(ies):
                            {duplicates.map((d) => (
                                <Link key={d.id} href={`/employment-applications/${d.id}`} className="ml-2 underline">
                                    {statuses[d.status] ?? d.status} ({formatDate(d.created_at)})
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
                        <AlertTitle className="text-red-700 dark:text-red-400">Enquiry Declined</AlertTitle>
                        <AlertDescription className="text-red-600 dark:text-red-300">
                            {app.declined_by_user && <>by {app.declined_by_user.name} on {formatDate(app.declined_at)}</>}
                            {app.declined_reason && <> — {app.declined_reason}</>}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Injury History — only loaded at WHS Review when applicant matches an employee */}
                {injuryHistory && (
                    <Card className="overflow-hidden">
                        <div className="flex items-start justify-between gap-3 border-b bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
                            <div className="flex items-start gap-2.5">
                                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <div>
                                    <p className="text-sm font-semibold">Prior injury history</p>
                                    <p className="text-xs text-muted-foreground">
                                        Matched to{' '}
                                        <Link href={`/employees/${injuryHistory.employee.id}`} className="text-primary hover:underline">
                                            {injuryHistory.employee.name}
                                        </Link>
                                        {injuryHistory.employee.is_archived && (
                                            <Badge variant="secondary" className="ml-1.5 text-[10px]">Archived</Badge>
                                        )}
                                        <span className="ml-1.5">·</span>
                                        <span className="ml-1.5">{injuryHistory.injuries.length} record{injuryHistory.injuries.length === 1 ? '' : 's'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {injuryHistory.injuries.length === 0 ? (
                            <p className="px-4 py-4 text-sm text-muted-foreground">No injury records on file for this employee.</p>
                        ) : (
                            <div className="divide-y">
                                {injuryHistory.injuries.map((inj) => (
                                    <div key={inj.id} className="px-4 py-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Link
                                                        href={`/injury-register/${inj.id}`}
                                                        className="text-sm font-medium text-primary hover:underline"
                                                    >
                                                        {inj.id_formal ?? `Injury #${inj.id}`}
                                                    </Link>
                                                    {inj.incident_label && (
                                                        <Badge variant="outline" className="text-[10px]">{inj.incident_label}</Badge>
                                                    )}
                                                    {inj.report_type_label && (
                                                        <Badge variant="secondary" className="text-[10px]">{inj.report_type_label}</Badge>
                                                    )}
                                                    {inj.work_cover_claim && (
                                                        <Badge className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700 hover:bg-rose-500/10">
                                                            WorkCover {inj.claim_status ?? 'claim'}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {inj.description && (
                                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{inj.description}</p>
                                                )}
                                                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                                    {inj.occurred_at && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {formatDate(inj.occurred_at)}
                                                        </span>
                                                    )}
                                                    {(inj.work_days_missed ?? 0) > 0 && (
                                                        <span>{inj.work_days_missed} days missed</span>
                                                    )}
                                                    {(inj.days_suitable_duties ?? 0) > 0 && (
                                                        <span>{inj.days_suitable_duties} days suitable duties</span>
                                                    )}
                                                </div>
                                            </div>
                                            <Link
                                                href={`/injury-register/${inj.id}`}
                                                className="text-muted-foreground hover:text-foreground shrink-0"
                                                aria-label="Open injury record"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {/* Mobile-only view switcher — desktop keeps both columns visible */}
                <div className="sticky top-0 z-10 -mx-3 flex border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-lg sm:border lg:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileView('details')}
                        aria-pressed={mobileView === 'details'}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
                            mobileView === 'details'
                                ? 'border-b-2 border-primary text-foreground sm:border-b-0 sm:bg-muted'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <FileText className="h-4 w-4" />
                        Details
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileView('activity')}
                        aria-pressed={mobileView === 'activity'}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
                            mobileView === 'activity'
                                ? 'border-b-2 border-primary text-foreground sm:border-b-0 sm:bg-muted'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <MessageSquare className="h-4 w-4" />
                        Activity
                        {messageCount > 0 && (
                            <span className="bg-muted text-muted-foreground ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                                {messageCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Single Card Layout */}
                <Card className="gap-0 overflow-hidden rounded-xl py-0 max-lg:min-h-[calc(100vh-12rem)] lg:min-h-[calc(100vh-7rem)]">
                    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
                        {/* Left Column — Main Content */}
                        <div className={cn('flex flex-col', mobileView !== 'activity' && 'max-lg:hidden')}>
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
                                    <div className="space-y-3">
                                        {filteredComments.map((comment) => (
                                            <CommentBubble
                                                key={comment.id}
                                                comment={comment}
                                                currentUserId={currentUserId}
                                                onEdit={handleEditComment}
                                                onDelete={handleDeleteComment}
                                                onOpenFormResponse={(id) => {
                                                    const fr = formRequestsById.get(id);
                                                    if (fr) setViewingFormRequest(fr);
                                                }}
                                                onReply={handleReplyClick}
                                                statusLabels={statuses}
                                                formRequestsById={formRequestsById}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Comment Input — AiRichTextEditor (mentions + attachments built in) */}
                            {canView && (
                                <div className="mt-auto p-3">
                                    {replyingTo && (
                                        <div className="mb-2 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs">
                                            <Reply className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-muted-foreground">Replying to <span className="font-medium text-foreground">{replyingTo.userName}</span></span>
                                            <button
                                                type="button"
                                                onClick={() => { setReplyingTo(null); setCommentDoc(null); }}
                                                className="text-muted-foreground hover:text-foreground ml-auto"
                                            >
                                                <XIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <AiRichTextEditor
                                        outputFormat="json"
                                        content={commentDoc}
                                        onChange={setCommentDoc}
                                        placeholder="Add a comment…"
                                        enableAttachments
                                        enableMentions
                                        collapseToolbar
                                        inlineActions
                                        editorClassName="min-h-0 py-1.5"
                                        attachments={attachments}
                                        onAttachmentsChange={setAttachments}
                                        trailingActions={
                                            <>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            type="button"
                                                            aria-label="Share"
                                                        >
                                                            <Share2 className="h-3.5 w-3.5" />
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
                                                <Button
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={handlePostComment}
                                                    disabled={submitting || (!docHasContent(commentDoc) && attachments.length === 0)}
                                                >
                                                    {replyingTo ? 'Reply' : 'Post'}
                                                </Button>
                                            </>
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right Column — Attributes Sidebar */}
                        <div className={cn(
                            'bg-muted/40 p-4 lg:border-l',
                            mobileView !== 'details' && 'max-lg:hidden',
                        )}>
                                {/* Name & Status */}
                                <div className="mb-4 flex items-start justify-between gap-2">
                                    <h2 className="text-lg font-semibold">
                                        {app.first_name} {app.surname}
                                    </h2>
                                    <StatusBadge status={app.status} labels={statuses} />
                                </div>

                                {/* Locked notice — enquiry is now a historical record; only comments remain open */}
                                {isLocked && (hasScreen || hasWhsReview || hasWhs || hasApprove) && (
                                    <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <div className="leading-snug">
                                            <p className="font-medium">Enquiry locked</p>
                                            <p className="mt-0.5 text-[11px]">Applicant has been onboarded. Only comments can be added — all other actions are disabled.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Status Controls */}
                                {(canScreen || canWhsReview || canWhs || canApprove) && (
                                    <div className="mb-4 space-y-2">
                                        {SYSTEM_STATUSES.includes(app.status) ? (
                                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                                                <StatusBadge status={app.status} labels={statuses} />
                                                <span className="text-xs">(system)</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <Select value={app.status} onValueChange={handleStatusChange}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Change status..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SELECTABLE_STATUSES.filter((s) => {
                                                            // Always include the current status so the trigger has a matching option.
                                                            if (s === app.status) return true;
                                                            if (s === 'whs_review') return canScreen || canWhsReview;
                                                            if (s === 'final_review') return canWhs;
                                                            if (s === 'approved') return canApprove;
                                                            if (SCREEN_STATUSES.includes(s)) return canScreen;
                                                            return false;
                                                        }).map((s) => (
                                                            <SelectItem key={s} value={s}>
                                                                {statuses[s]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {auth.isAdmin && (
                                                    <TooltipProvider delay={100}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-9 w-9 shrink-0"
                                                                    onClick={() => router.post(route('employment-applications.retrigger-stage-actions', app.id), {}, { preserveScroll: true })}
                                                                    aria-label="Re-trigger stage actions"
                                                                >
                                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Re-trigger stage actions</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        )}
                                        {pageErrors.status && (
                                            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{pageErrors.status}</p>
                                        )}

                                        {/* Action Buttons — contextual based on current status */}
                                        {canScreen && (
                                            <div className="flex gap-2">
                                                {['approved', 'contract_sent', 'contract_signed'].includes(app.status) && (
                                                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowSigningModal(true)}>
                                                        <Send className="mr-1.5 h-3.5 w-3.5" />
                                                        Send Docs
                                                    </Button>
                                                )}
                                                {['approved', 'contract_sent', 'contract_signed'].includes(app.status) && (
                                                    <Button size="sm" className="flex-1" onClick={() => router.visit(route('employment-applications.send', app.id))}>
                                                        <Send className="mr-1.5 h-3.5 w-3.5" />
                                                        Send Docs — New
                                                    </Button>
                                                )}
                                                {app.status === 'contract_signed' && (
                                                    <Button size="sm" variant="default" className="flex-1" onClick={() => setShowOnboardModal(true)}>
                                                        <User className="mr-1.5 h-3.5 w-3.5" />
                                                        Payroll
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Pending Signing Requests — only show unsigned docs */}
                                {signingRequests.filter((sr) => sr.status !== 'signed').length > 0 && (
                                    <div className="mb-3 space-y-1.5">
                                        {signingRequests.filter((sr) => sr.status !== 'signed').map((sr) => (
                                            <div key={sr.id} className="flex items-center gap-2 rounded-md border bg-background p-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-xs font-medium leading-tight">{sr.document_template?.name ?? 'Document'}</p>
                                                    <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
                                                        {sr.status}
                                                        {' · '}
                                                        {sr.delivery_method === 'email' ? 'via email' : 'in-person'}
                                                    </p>
                                                </div>
                                                {canScreen && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon-sm" aria-label="Document actions">
                                                                <EllipsisVertical className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-36">
                                                            <DropdownMenuItem onClick={() => router.post(route('signing-requests.resend', sr.id), {}, { preserveScroll: true })}>
                                                                <Send className="mr-2 h-3.5 w-3.5" /> Resend
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => router.post(route('signing-requests.cancel', sr.id), {}, { preserveScroll: true })}>
                                                                <XCircle className="mr-2 h-3.5 w-3.5" /> Cancel
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Per-reference form status — surfaces the on-demand
                                    Reference Check mapping for the current trigger stage.
                                    Hidden unless the application is in a status where an
                                    on-demand mapping with subject_source='references' exists. */}
                                {(() => {
                                    const refMapping = (availableOnDemandForms ?? []).find(
                                        (m) => m.subject_source === 'references',
                                    );
                                    if (!refMapping || app.references.length === 0) return null;

                                    const referenceFormFor = (refId: number): FormRequestData | undefined =>
                                        formRequests.find(
                                            (fr) =>
                                                fr.subject_type === 'App\\Models\\EmploymentApplicationReference' &&
                                                fr.subject_id === refId &&
                                                fr.form_template?.id === refMapping.form_template_id,
                                        );

                                    const submittedCount = app.references.filter(
                                        (r) => referenceFormFor(r.id)?.status === 'submitted',
                                    ).length;
                                    const minRequired = refMapping.min_submissions;
                                    const goalMet = submittedCount >= minRequired;

                                    return (
                                        <div className="mb-3 rounded-lg border bg-background p-2">
                                            <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {refMapping.form_template_name ?? 'Reference Checks'}
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        'shrink-0 text-[10px]',
                                                        goalMet && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
                                                    )}
                                                >
                                                    {submittedCount} of {minRequired} completed
                                                </Badge>
                                            </div>
                                            <div className="space-y-1.5">
                                                {app.references.map((ref) => {
                                                    const fr = referenceFormFor(ref.id);
                                                    const status = fr?.status;
                                                    const label = ref.contact_person?.trim() || ref.company_name || `Reference #${ref.id}`;
                                                    const subLabel = ref.contact_person && ref.company_name
                                                        ? ref.company_name
                                                        : ref.phone_number ?? null;
                                                    const isPending = status === 'pending' || status === 'sent' || status === 'opened';
                                                    const avatarName = ref.contact_person?.trim() || ref.company_name || '?';
                                                    const initials = avatarName.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
                                                    return (
                                                        <div key={ref.id} className="flex items-center gap-2 rounded-md border p-2">
                                                            <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
                                                                {initials}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-medium leading-tight">{label}</p>
                                                                <p className="text-muted-foreground truncate text-[11px] leading-tight">
                                                                    {status === 'submitted'
                                                                        ? 'Completed'
                                                                        : isPending
                                                                          ? 'In progress'
                                                                          : status === 'cancelled'
                                                                            ? 'Skipped'
                                                                            : 'Not started'}
                                                                    {subLabel && ` · ${subLabel}`}
                                                                </p>
                                                            </div>
                                                            {!fr && canScreen && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 shrink-0 text-xs"
                                                                    onClick={() =>
                                                                        router.post(
                                                                            route('employment-applications.references.start-form', [app.id, ref.id, refMapping.id]),
                                                                            {},
                                                                            { preserveScroll: true },
                                                                        )
                                                                    }
                                                                >
                                                                    Start
                                                                </Button>
                                                            )}
                                                            {fr && isPending && canFillFormRequest(fr) && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 shrink-0 text-xs"
                                                                    onClick={() => setFillingFormRequest(fr)}
                                                                    disabled={!fr.form_template?.fields?.length}
                                                                >
                                                                    Continue
                                                                </Button>
                                                            )}
                                                            {fr && status === 'submitted' && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 shrink-0 text-xs"
                                                                    onClick={() => setViewingFormRequest(fr)}
                                                                >
                                                                    View
                                                                </Button>
                                                            )}
                                                            {fr && isPending && canScreen && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon-sm" aria-label="Reference actions">
                                                                            <EllipsisVertical className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-32">
                                                                        <DropdownMenuItem className="text-destructive" onClick={() => router.post(route('form-requests.cancel', fr.id), {}, { preserveScroll: true })}>
                                                                            <XCircle className="mr-2 h-3.5 w-3.5" /> Skip
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Pending Form Requests — only show unsubmitted forms.
                                    Subject-scoped forms (e.g. reference checks) live in
                                    their own contextual card above; excluded here to
                                    avoid showing the same form twice. */}
                                {(() => {
                                    const pendingGeneric = formRequests.filter(
                                        (fr) => fr.status !== 'submitted' && !fr.subject_id,
                                    );
                                    if (pendingGeneric.length === 0) return null;
                                    return (
                                    <div className="mb-3 space-y-1.5">
                                        {pendingGeneric.map((fr) => {
                                            const isPermissionAssigned = fr.assignee_strategy === 'permission' && !!fr.assignee_permission;
                                            const isInApp = fr.delivery_method === 'in_app';
                                            const fillable = canFillFormRequest(fr);
                                            const statusLabel = isInApp && fr.status !== 'submitted' && fr.status !== 'cancelled' ? 'open' : fr.status;
                                            const deliveryLabel = fr.delivery_method === 'email' ? 'via email' : isInApp ? 'in-app' : 'in-person';
                                            const canManage = canScreen && (!isPermissionAssigned || canScreen);
                                            return (
                                                <div key={fr.id} className="flex items-center gap-2 rounded-md border bg-background p-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="line-clamp-2 text-xs font-medium leading-tight">{fr.form_template?.name ?? 'Form'}</p>
                                                        <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
                                                            {statusLabel} · {deliveryLabel}
                                                        </p>
                                                    </div>
                                                    {fillable && (
                                                        <Button
                                                            size="sm"
                                                            className="h-7 shrink-0 text-xs"
                                                            onClick={() => setFillingFormRequest(fr)}
                                                            disabled={!fr.form_template?.fields?.length}
                                                        >
                                                            Fill out
                                                        </Button>
                                                    )}
                                                    {canManage && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon-sm" aria-label="Form actions">
                                                                    <EllipsisVertical className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-36">
                                                                {!isPermissionAssigned && (
                                                                    <DropdownMenuItem onClick={() => router.post(route('form-requests.resend', fr.id), {}, { preserveScroll: true })}>
                                                                        <Send className="mr-2 h-3.5 w-3.5" /> Resend
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem className="text-destructive" onClick={() => router.post(route('form-requests.cancel', fr.id), {}, { preserveScroll: true })}>
                                                                    <XCircle className="mr-2 h-3.5 w-3.5" /> Cancel
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    );
                                })()}

                                {app.employees.length > 0 && (
                                    <>
                                        <Separator className="mb-1" />
                                        {app.employees.map((emp) => (
                                            <SidebarAttribute key={emp.id} icon={UserCheck} label="Linked Employee">
                                                <Link
                                                    href={`/employees/${emp.id}`}
                                                    className="text-primary! no-underline! inline-flex items-center font-medium hover:text-primary/80! hover:no-underline!"
                                                >
                                                    {emp.name}
                                                </Link>
                                                {emp.eh_employee_id && <span className="text-muted-foreground text-xs ml-1">(EH: {emp.eh_employee_id})</span>}
                                            </SidebarAttribute>
                                        ))}
                                    </>
                                )}

                                <Separator className="mb-1" />

                                {/* Personal Details */}
                                <div className="divide-y">
                                    {!(app.latitude && app.longitude) && app.suburb && (
                                        <SidebarAttribute icon={MapPin} label="Suburb">
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.suburb)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary! no-underline! inline-flex items-start gap-1 hover:text-primary/80! hover:no-underline!"
                                            >
                                                <span>{app.suburb}</span>
                                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                                            </a>
                                        </SidebarAttribute>
                                    )}

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

                                </div>

                                <Separator className="my-1" />

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
                                        <Separator className="my-1" />
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

                                <Separator className="my-1" />

                                {/* View Full Submission — opens side pane; styled as a "file card" */}
                                <button
                                    type="button"
                                    onClick={() => setShowSubmissionPane(true)}
                                    className="group mt-2 flex w-full items-center gap-2.5 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
                                >
                                    <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1 leading-tight">
                                        <p className="truncate text-xs font-medium">Full Submission</p>
                                        <p className="text-muted-foreground text-[11px]">Application form responses</p>
                                    </div>
                                    <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                                </button>

                                {canApprove && app.status !== 'declined' && app.status !== 'onboarded' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeclineDialog(true)}
                                        className="mt-1 flex items-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-destructive"
                                    >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Decline Enquiry
                                    </button>
                                )}

                                {auth.isAdmin && !isLocked && (
                                    <div className="mt-2 flex items-center gap-1">
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Admin</span>
                                        <span aria-hidden className="h-px flex-1 bg-border" />
                                        <TooltipProvider delay={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowResetDialog(true)}
                                                        aria-label="Reset to New"
                                                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>Reset to New</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setDeleteAppConfirmText(''); setShowDeleteAppDialog(true); }}
                                                        aria-label="Delete application"
                                                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                                    >
                                                        <Trash className="h-3.5 w-3.5" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>Hard delete application</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                )}

                                {/* Mini map */}
                                {app.latitude && app.longitude && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.address || app.suburb || `${app.latitude},${app.longitude}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 block cursor-pointer"
                                    >
                                        <p className="text-muted-foreground mb-1.5 flex items-center gap-1 text-xs font-medium">
                                            <MapPin className="h-3 w-3" />
                                            {app.address || app.suburb}
                                        </p>
                                        {/* `isolate` creates a local stacking context so Leaflet's
                                            high internal z-indexes (controls hit 1000) can't outrank
                                            app-level dialogs/sheets, which sit at z-50. */}
                                        <div className="isolate relative z-0">
                                            <Suspense fallback={<div className="bg-muted h-[180px] w-full animate-pulse rounded-lg" />}>
                                                <ApplicantMiniMap
                                                    latitude={Number(app.latitude)}
                                                    longitude={Number(app.longitude)}
                                                    name={`${app.first_name} ${app.surname}`}
                                                    suburb={app.suburb}
                                                />
                                            </Suspense>
                                        </div>
                                    </a>
                                )}
                        </div>
                    </div>
                </Card>
            </div>
            </div>

            {/* Full Submission Side Pane — non-modal, leaves main content interactive */}
            {showSubmissionPane && (
                <aside
                    className={cn(
                        'bg-background fixed inset-y-0 z-30 flex w-full max-w-[520px] flex-col border-l shadow-2xl animate-in slide-in-from-right duration-200',
                        // Sit beside the form pane (form on far right, submission to its left) at xl+
                        // so both are visible. Below xl, dock right-0 same as before — the most
                        // recently opened pane sits on top.
                        fillingFormRequest || viewingFormRequest ? 'right-0 xl:right-[520px]' : 'right-0',
                    )}
                    aria-label="Full submission"
                >
                    <div className="bg-background flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                                {app.first_name} {app.surname} — Full Submission
                            </p>
                            <p className="text-muted-foreground text-xs truncate">
                                Submitted {formatDate(app.created_at)}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <a
                                href={`/employment-applications/${app.id}/submission/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors"
                                title="Download PDF"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowSubmissionPane(false)}
                                className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                                title="Close"
                                aria-label="Close submission pane"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <SubmissionContent
                            application={app}
                            showSectionIndicator={false}
                            fieldGridClassName="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2"
                        />
                    </div>
                </aside>
            )}

            {/* Decline Dialog */}
            <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Decline Enquiry</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to decline {app.first_name} {app.surname}'s enquiry?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="decline_reason">Reason (optional)</Label>
                            <Textarea
                                id="decline_reason"
                                value={declineForm.data.reason}
                                onChange={(e) => declineForm.setData('reason', e.target.value)}
                                placeholder="Enter reason for declining..."
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="add_to_screening"
                                checked={declineForm.data.add_to_screening}
                                onCheckedChange={(checked) => declineForm.setData('add_to_screening', !!checked)}
                            />
                            <Label htmlFor="add_to_screening" className="text-sm font-normal">
                                Add to alert list for future worker screening
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDecline} disabled={declineForm.processing}>
                            {declineForm.processing ? 'Declining...' : 'Decline'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset to New — admin-only hard reset */}
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset to New</DialogTitle>
                        <DialogDescription>
                            Permanently delete all workflow data on {app.first_name} {app.surname}'s enquiry and reset it to a brand new state. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
                        <p className="mb-2 font-medium text-foreground">The following will be hard-deleted:</p>
                        <ul className="list-disc space-y-1 pl-4">
                            <li>All checklists and checklist activity logs</li>
                            <li>All comments and attachments</li>
                            <li>All form requests and signing requests</li>
                            <li>Face-to-face screening interview</li>
                            <li>Linked employee records</li>
                        </ul>
                        <p className="mt-2">
                            Applicant-supplied data (name, contact, references, skills) is preserved. Auto-attach checklists will be re-applied.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={resetProcessing}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReset} disabled={resetProcessing}>
                            {resetProcessing ? 'Resetting...' : 'Reset to New'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Application — admin-only hard delete */}
            <Dialog open={showDeleteAppDialog} onOpenChange={setShowDeleteAppDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Application</DialogTitle>
                        <DialogDescription>
                            Permanently delete {app.first_name} {app.surname}'s enquiry and every related record. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
                        <p className="mb-2 font-medium text-foreground">Everything will be hard-deleted:</p>
                        <ul className="list-disc space-y-1 pl-4">
                            <li>The application itself (no soft-delete — gone for good)</li>
                            <li>All checklists, items and activity logs</li>
                            <li>All comments and attachments</li>
                            <li>All form requests and signing requests</li>
                            <li>Face-to-face screening interview</li>
                            <li>Reference list, reference checks and skills</li>
                            <li>Linked employee records (the employees themselves are not deleted)</li>
                        </ul>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="delete_confirm">
                            Type <span className="font-semibold text-foreground">{app.first_name}</span> to confirm
                        </Label>
                        <Input
                            id="delete_confirm"
                            value={deleteAppConfirmText}
                            onChange={(e) => setDeleteAppConfirmText(e.target.value)}
                            placeholder={app.first_name}
                            autoComplete="off"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteAppDialog(false)} disabled={deleteAppProcessing}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteApplication}
                            disabled={deleteAppProcessing || deleteAppConfirmText.trim() !== app.first_name}
                        >
                            {deleteAppProcessing ? 'Deleting...' : 'Delete Permanently'}
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
                    {editingComment && (
                        <div className="rounded-md border">
                            <AiRichTextEditor
                                key={editingComment.id}
                                outputFormat="json"
                                content={editDoc}
                                onChange={setEditDoc}
                                placeholder="Edit your comment…"
                                enableMentions
                                collapseToolbar
                                inlineActions
                                editorClassName="min-h-24 p-3"
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={editSaving || !docHasContent(editDoc)}>
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

            {/* Fill phase form in-app */}
            <FormFillPane
                formRequest={fillingFormRequest}
                onClose={() => setFillingFormRequest(null)}
            />

            {/* View a submitted form response */}
            <FormResponsePane
                formRequest={viewingFormRequest}
                onClose={() => setViewingFormRequest(null)}
            />

        </AppLayout>
    );
}

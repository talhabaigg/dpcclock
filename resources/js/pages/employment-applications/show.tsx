import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    ChevronRight,
    ExternalLink,
    FileIcon,
    Mail,
    MapPin,
    MessageSquare,
    Paperclip,
    Phone,
    Send,
    User,
    Wrench,
    XCircle,
    XIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';

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
    metadata: Record<string, unknown> | null;
    user: UserModel | null;
    created_at: string;
    attachments: Attachment[];
    replies?: CommentData[];
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

interface Duplicate {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    status: string;
    created_at: string;
}

interface PageProps {
    application: Application;
    comments: CommentData[];
    duplicates: Duplicate[];
    statuses: string[];
    auth: { permissions?: string[]; isAdmin?: boolean };
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

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    reviewing: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    phone_interview: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800',
    reference_check: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-800',
    face_to_face: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    contract_sent: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
    contract_signed: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800',
    onboarded: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
    declined: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
};

const PIPELINE_STATUSES = ['new', 'reviewing', 'phone_interview', 'reference_check', 'face_to_face', 'approved', 'contract_sent', 'contract_signed', 'onboarded'];

function StatusBadge({ status, className }: { status: string; className?: string }) {
    return (
        <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[status], className)}>
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

function CommentBubble({ comment }: { comment: CommentData }) {
    const isSystem = comment.metadata !== null;
    const statusChange = comment.metadata?.status_change as { from: string; to: string } | undefined;

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
            <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isSystem ? 'bg-slate-100 dark:bg-slate-800' : 'bg-primary/10',
            )}>
                {isSystem ? (
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                ) : (
                    <MessageSquare className="text-primary h-4 w-4" />
                )}
            </div>
            <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm">
                    <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{formatDateTime(comment.created_at)}</span>
                </p>
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
                            <CommentBubble key={reply.id} comment={reply} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function EmploymentApplicationShow({ application: app, comments, duplicates, statuses }: PageProps) {
    const { auth } = usePage<{ auth: { permissions?: string[]; isAdmin?: boolean } }>().props;
    const permissions = auth.permissions ?? [];
    const canScreen = auth.isAdmin || permissions.includes('employment-applications.screen');

    const [showDeclineDialog, setShowDeclineDialog] = useState(false);
    const [commentBody, setCommentBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(undefined);

    const statusForm = useForm({ status: '' });
    const declineForm = useForm({ reason: '' });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Applications', href: '/employment-applications' },
        { title: `${app.first_name} ${app.surname}`, href: `/employment-applications/${app.id}` },
    ];

    const occupationDisplay = app.occupation === 'other' && app.occupation_other ? app.occupation_other : app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);

    function handleStatusChange(newStatus: string) {
        if (newStatus === 'declined') {
            setShowDeclineDialog(true);
            return;
        }
        statusForm.setData('status', newStatus);
        statusForm.patch(route('employment-applications.update-status', app.id), {
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${app.first_name} ${app.surname} — Application`} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
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

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                    {/* Left Column — Main Content */}
                    <div className="flex flex-col gap-4">

                        {/* Checklist Section */}
                        <Card className="rounded-xl">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold">Checklist</CardTitle>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button type="button" className="text-primary hover:underline">+ New item</button>
                                        <span className="text-muted-foreground">|</span>
                                        <button type="button" className="text-primary hover:underline">+ Add checklist</button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm italic">No checklist items yet.</p>
                            </CardContent>
                        </Card>

                        {/* Activity / Comments Feed */}
                        <Card className="flex min-h-[400px] flex-col rounded-xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Activity</CardTitle>
                            </CardHeader>

                            <CardContent className="flex-1 space-y-4">
                                {comments.length === 0 && (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No activity yet. Post a comment to get started.
                                    </p>
                                )}
                                {comments.map((comment) => (
                                    <CommentBubble key={comment.id} comment={comment} />
                                ))}
                            </CardContent>

                            {/* Comment Input */}
                            {canScreen && (
                                <div className="border-t p-3">
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
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0"
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Paperclip className="h-4 w-4" />
                                        </Button>
                                        <Textarea
                                            placeholder="Enter message here..."
                                            className="min-h-[40px] flex-1 resize-none"
                                            rows={1}
                                            value={commentBody}
                                            onChange={(e) => setCommentBody(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                    e.preventDefault();
                                                    handlePostComment();
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            className="shrink-0 gap-1.5"
                                            onClick={handlePostComment}
                                            disabled={submitting || (!commentBody.trim() && attachments.length === 0)}
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                            Share
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Right Column — Attributes Sidebar */}
                    <div className="lg:sticky lg:top-4 lg:self-start">
                        <Card className="rounded-xl">
                            <CardContent className="pt-5">
                                {/* Name & Status */}
                                <div className="mb-4 flex items-start justify-between gap-2">
                                    <h2 className="text-lg font-semibold">
                                        {app.first_name} {app.surname}
                                    </h2>
                                    <StatusBadge status={app.status} />
                                </div>

                                {/* Status Controls */}
                                {canScreen && (
                                    <div className="mb-4">
                                        <Select onValueChange={handleStatusChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Change status..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[...PIPELINE_STATUSES, 'declined']
                                                    .filter((s) => s !== app.status)
                                                    .map((s) => (
                                                        <SelectItem key={s} value={s}>
                                                            {STATUS_LABELS[s]}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <Separator className="mb-2" />

                                {/* Attributes */}
                                <div className="divide-y">
                                    <SidebarAttribute icon={Mail} label="Email">
                                        <a href={`mailto:${app.email}`} className="text-primary hover:underline">{app.email}</a>
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={Phone} label="Phone">
                                        <a href={`tel:${app.phone}`} className="text-primary hover:underline">{app.phone}</a>
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={MapPin} label="Suburb">
                                        {app.suburb}
                                    </SidebarAttribute>

                                    <SidebarAttribute icon={Wrench} label="Occupation">
                                        <span>{occupationDisplay}</span>
                                        {app.trade_qualified && <Badge variant="secondary" className="ml-1.5 text-[10px]">Trade Qualified</Badge>}
                                        {app.apprentice_year && <Badge variant="outline" className="ml-1.5 text-[10px]">Year {app.apprentice_year}</Badge>}
                                    </SidebarAttribute>

                                    {app.preferred_project_site && (
                                        <SidebarAttribute icon={MapPin} label="Preferred Site">
                                            {app.preferred_project_site}
                                        </SidebarAttribute>
                                    )}

                                    <SidebarAttribute icon={Calendar} label="Applied">
                                        {formatDate(app.created_at)}
                                    </SidebarAttribute>

                                    {app.referred_by && (
                                        <SidebarAttribute icon={User} label="Referred By">
                                            {app.referred_by}
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

                                {/* References summary */}
                                {app.references.length > 0 && (
                                    <>
                                        <Separator className="my-2" />
                                        <div className="py-2">
                                            <p className="text-muted-foreground mb-2 text-xs">References ({app.references.length})</p>
                                            <div className="space-y-1.5">
                                                {app.references.map((ref) => (
                                                    <div key={ref.id} className="text-xs">
                                                        <span className="font-medium">{ref.contact_person}</span>
                                                        <span className="text-muted-foreground"> — {ref.company_name}</span>
                                                    </div>
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
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

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

        </AppLayout>
    );
}

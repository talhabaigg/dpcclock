import { SuccessAlertFlash } from '@/components/alert-flash';
import { CommentBody } from '@/components/comments/comment-body';
import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import type { JSONContent } from '@tiptap/react';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryFormOptions } from '@/types/injury';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormFillPane, FormResponsePane, type FormRequestData } from '@/components/form-renderer/form-fill-pane';
import { Activity, ArrowRight, CalendarIcon, ClipboardCheck, Download, File as FileIcon, FileImage, FileText, Loader2, Lock, Mail, MessageSquare, Paperclip, Pencil, Send, Trash2, Unlock, X } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from '../../pdf-worker-with-polyfill?worker&url';
import { useEffect, useRef, useState } from 'react';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Attachment {
    id: number;
    file_name: string;
    url: string;
    mime_type: string;
}

interface CommentData {
    id: number;
    body: string;
    body_json: JSONContent | null;
    metadata: Record<string, unknown> | null;
    user: { id: number; name: string } | null;
    created_at: string;
    mentioned_users?: {
        id: number;
        name: string;
        email?: string | null;
        phone?: string | null;
        position?: string | null;
        is_active?: boolean;
    }[];
    attachments: Attachment[];
    replies?: CommentData[];
}

interface NotifyUser {
    id: number;
    name: string;
    email: string | null;
    has_sms: boolean;
}

interface Props {
    injury: Injury;
    comments: CommentData[];
    options: InjuryFormOptions;
    notifyUsers: NotifyUser[];
    formRequests: FormRequestData[];
}

function UserAvatar({ name }: { name: string }) {
    const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            {initials}
        </div>
    );
}

function attachmentKind(mime: string): 'pdf' | 'image' | 'other' {
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    return 'other';
}

function PdfThumbnail({ url }: { url: string }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

    useEffect(() => {
        let cancelled = false;
        setState('loading');
        const task = getDocument(url);

        task.promise
            .then(async (pdf) => {
                if (cancelled) return;
                const page = await pdf.getPage(1);
                if (cancelled || !canvasRef.current) return;

                const baseViewport = page.getViewport({ scale: 1 });
                const targetWidth = 360;
                const scale = targetWidth / baseViewport.width;
                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvas, canvasContext: context, viewport }).promise;
                if (!cancelled) setState('ready');
            })
            .catch(() => { if (!cancelled) setState('error'); });

        return () => { cancelled = true; task.destroy(); };
    }, [url]);

    if (state === 'error') {
        return <FileText className="text-muted-foreground h-10 w-10" />;
    }
    return (
        <>
            {state === 'loading' && <Loader2 className="text-muted-foreground absolute h-4 w-4 animate-spin" />}
            <canvas
                ref={canvasRef}
                className={`h-full w-full object-cover object-top ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            />
        </>
    );
}

function AttachmentCard({ attachment, onPreview }: { attachment: Attachment; onPreview: (a: Attachment) => void }) {
    const kind = attachmentKind(attachment.mime_type);
    const Icon = kind === 'pdf' ? FileText : kind === 'image' ? FileImage : FileIcon;

    return (
        <div className="group relative h-32 w-44 overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:border-foreground/30 hover:shadow-md">
            <button
                type="button"
                onClick={() => onPreview(attachment)}
                className="bg-muted/40 flex h-full w-full items-center justify-center overflow-hidden"
                title={attachment.file_name}
                aria-label={`Open ${attachment.file_name}`}
            >
                {kind === 'pdf' && <PdfThumbnail url={attachment.url} />}
                {kind === 'image' && (
                    <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                )}
                {kind === 'other' && <Icon className="text-muted-foreground h-10 w-10" />}
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate text-[11px] font-medium leading-tight text-white">{attachment.file_name}</div>
            </div>
            <a
                href={attachment.url}
                download={attachment.file_name}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Download ${attachment.file_name}`}
                title="Download"
            >
                <Download className="h-3.5 w-3.5" />
            </a>
        </div>
    );
}

interface AttachmentPreviewContext {
    uploaderName?: string | null;
    uploadedAt?: string;
}

interface AttachmentPreview {
    attachment: Attachment;
    siblings: Attachment[];
    context?: AttachmentPreviewContext;
}

function AttachmentList({ attachments, onPreview, context, compact = false }: {
    attachments: Attachment[];
    onPreview: (preview: AttachmentPreview) => void;
    context?: AttachmentPreviewContext;
    compact?: boolean;
}) {
    if (attachments.length === 0) return null;
    return (
        <div className={`flex flex-wrap gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
            {attachments.map((att) => (
                <AttachmentCard
                    key={att.id}
                    attachment={att}
                    onPreview={(a) => onPreview({ attachment: a, siblings: attachments, context })}
                />
            ))}
        </div>
    );
}

function AttachmentPreviewDialog({ preview, onClose }: { preview: AttachmentPreview | null; onClose: () => void }) {
    const open = preview !== null;
    const [activeId, setActiveId] = useState<number | null>(null);

    useEffect(() => {
        setActiveId(preview?.attachment.id ?? null);
    }, [preview?.attachment.id]);

    const active = preview
        ? preview.siblings.find((s) => s.id === activeId) ?? preview.attachment
        : null;
    const kind = active ? attachmentKind(active.mime_type) : 'other';
    const imageSiblings = preview ? preview.siblings.filter((s) => attachmentKind(s.mime_type) === 'image') : [];
    const hasGallery = kind === 'image' && imageSiblings.length > 1;
    const activeIndex = active ? imageSiblings.findIndex((s) => s.id === active.id) : -1;
    const typeLabel = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : active ? (active.mime_type.split('/')[1] ?? 'File').toUpperCase() : '';

    useEffect(() => {
        if (!open || !hasGallery || activeIndex === -1) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const next = e.key === 'ArrowRight'
                ? (activeIndex + 1) % imageSiblings.length
                : (activeIndex - 1 + imageSiblings.length) % imageSiblings.length;
            setActiveId(imageSiblings[next].id);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, hasGallery, activeIndex, imageSiblings]);

    const headingText = hasGallery && activeIndex !== -1
        ? `Photo ${activeIndex + 1} of ${imageSiblings.length}`
        : kind === 'image' ? 'Photo'
        : kind === 'pdf' ? 'PDF'
        : 'File';

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent
                className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl md:flex-row"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>{active?.file_name ?? headingText}</DialogTitle>
                </DialogHeader>

                <div className="bg-muted/30 relative flex flex-1 overflow-hidden md:order-2">
                    {active && kind === 'pdf' && (
                        <iframe src={active.url} title={active.file_name} className="h-full w-full bg-white" />
                    )}
                    {active && kind === 'image' && (
                        <div className="flex h-full w-full items-center justify-center p-4">
                            <img src={active.url} alt={active.file_name} className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    {active && kind === 'other' && (
                        <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center text-sm">
                            <FileIcon className="h-12 w-12 opacity-50" />
                            <p>No preview available for this file type.</p>
                        </div>
                    )}
                </div>

                {hasGallery && (
                    <div className="bg-muted/40 flex h-20 shrink-0 gap-2 overflow-x-auto border-t p-2 md:order-1 md:h-auto md:w-20 md:flex-col md:overflow-x-visible md:overflow-y-auto md:border-r md:border-t-0">
                        {imageSiblings.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setActiveId(s.id)}
                                className={cn(
                                    'relative aspect-square h-full shrink-0 overflow-hidden rounded border-2 transition-all md:h-auto md:w-full',
                                    s.id === active?.id
                                        ? 'border-primary'
                                        : 'border-transparent hover:border-muted-foreground/30',
                                )}
                                aria-label={s.file_name}
                                aria-current={s.id === active?.id}
                            >
                                <img src={s.url} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                <aside className="bg-background flex max-h-[35vh] shrink-0 flex-col gap-3 overflow-y-auto border-t p-4 pr-12 md:order-3 md:max-h-none md:w-72 md:gap-5 md:border-l md:border-t-0 md:p-5">
                    <h2 className="text-base font-semibold leading-tight">{headingText}</h2>

                    <div className="space-y-1.5 md:space-y-2 md:border-t md:pt-4">
                        <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Details</h3>
                        {preview?.context?.uploaderName && (
                            <p className="text-sm font-medium">Uploaded by {preview.context.uploaderName}</p>
                        )}
                        {preview?.context?.uploadedAt && (
                            <p className="text-muted-foreground text-sm">
                                Uploaded {new Date(preview.context.uploadedAt).toLocaleString('en-AU')}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5 md:space-y-2 md:border-t md:pt-4">
                        <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">File</h3>
                        <p className="break-words text-sm">{active?.file_name}</p>
                        {typeLabel && (
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">{typeLabel}</p>
                        )}
                    </div>

                    {active && (
                        <Button asChild variant="outline" size="sm" className="mt-1 md:mt-auto">
                            <a href={active.url} download={active.file_name}>
                                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                            </a>
                        </Button>
                    )}
                </aside>
            </DialogContent>
        </Dialog>
    );
}

function AttachmentBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
            <Paperclip className="h-2.5 w-2.5" />
            {count}
        </span>
    );
}

function SystemComment({ comment, onPreviewAttachment, onOpenFormResponse }: {
    comment: CommentData;
    onPreviewAttachment: (preview: AttachmentPreview) => void;
    onOpenFormResponse?: (formRequestId: number) => void;
}) {
    const metadata = comment.metadata as Record<string, unknown> | null;
    const event = metadata?.event as string | undefined;
    const metaType = metadata?.type as string | undefined;
    const formSubmittedMeta = metaType === 'form_submitted'
        ? (metadata as { type: string; form_request_id: number; form_name: string })
        : undefined;

    return (
        <div className="flex items-start gap-3">
            <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                {event === 'locked' ? (
                    <Lock className="h-3 w-3 text-amber-500" />
                ) : event === 'unlocked' ? (
                    <Unlock className="h-3 w-3 text-green-500" />
                ) : formSubmittedMeta ? (
                    <ClipboardCheck className="h-3 w-3 text-emerald-600" />
                ) : (
                    <Activity className="text-muted-foreground h-3 w-3" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">{comment.user?.name ?? 'System'}</span>
                    <span className="text-muted-foreground text-xs">{new Date(comment.created_at).toLocaleString('en-AU')}</span>
                    <AttachmentBadge count={comment.attachments.length} />
                </div>
                {comment.body && (
                    <p className="text-muted-foreground mt-0.5 text-xs whitespace-pre-wrap"
                       dangerouslySetInnerHTML={{ __html: comment.body.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>').replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>') }}
                    />
                )}
                <AttachmentList
                    attachments={comment.attachments}
                    onPreview={onPreviewAttachment}
                    context={{ uploaderName: comment.user?.name ?? 'System', uploadedAt: comment.created_at }}
                    compact
                />
                {formSubmittedMeta && onOpenFormResponse && (
                    <button
                        type="button"
                        onClick={() => onOpenFormResponse(formSubmittedMeta.form_request_id)}
                        className="bg-background text-foreground hover:bg-muted mt-1.5 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors"
                    >
                        <ClipboardCheck className="h-3 w-3" />
                        View response
                    </button>
                )}
            </div>
        </div>
    );
}

function CommentBubble({ comment, currentUserId, onEdit, onDelete, onPreviewAttachment, onOpenFormResponse }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
    onPreviewAttachment: (preview: AttachmentPreview) => void;
    onOpenFormResponse?: (formRequestId: number) => void;
}) {
    if (comment.metadata) {
        return <SystemComment comment={comment} onPreviewAttachment={onPreviewAttachment} onOpenFormResponse={onOpenFormResponse} />;
    }

    const isOwner = currentUserId !== undefined && comment.user?.id === currentUserId;

    return (
        <div className="flex gap-3">
            {comment.user ? (
                <UserAvatar name={comment.user.name} />
            ) : (
                <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs">S</div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.user?.name ?? 'System'}</span>
                    <span className="text-muted-foreground text-xs">{new Date(comment.created_at).toLocaleString('en-AU')}</span>
                    <AttachmentBadge count={comment.attachments.length} />
                    {isOwner && (
                        <div className="ml-auto flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit?.(comment)}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => onDelete?.(comment.id)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
                <CommentBody doc={comment.body_json} fallback={comment.body} mentionedUsers={comment.mentioned_users} />
                <AttachmentList
                    attachments={comment.attachments}
                    onPreview={onPreviewAttachment}
                    context={{ uploaderName: comment.user?.name ?? 'System', uploadedAt: comment.created_at }}
                />
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 pl-6">
                        {comment.replies.map((reply) => (
                            <CommentBubble key={reply.id} comment={reply} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} onPreviewAttachment={onPreviewAttachment} onOpenFormResponse={onOpenFormResponse} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SidebarField({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm">{value || '—'}</dd>
        </div>
    );
}

export default function InjuryShow({ injury, comments, options, notifyUsers, formRequests }: Props) {
    const pageProps = usePage().props;
    const auth = pageProps.auth as { user?: { id: number }; permissions?: string[] };
    const flash = pageProps.flash as { success?: string } | undefined;
    const appEnv = pageProps.appEnv as string;
    const currentUserId = auth?.user?.id;
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    function canFillFormRequest(fr: FormRequestData): boolean {
        if (fr.assignee_strategy === 'permission' && fr.assignee_permission) {
            return permissions.includes(fr.assignee_permission);
        }
        if (fr.assignee_strategy === 'user' && fr.assignee_user_id) {
            return currentUserId === fr.assignee_user_id;
        }
        return false;
    }

    const pendingFormRequests = formRequests.filter((fr) => fr.status !== 'submitted' && fr.status !== 'cancelled');

    const [fillingFormRequest, setFillingFormRequest] = useState<FormRequestData | null>(null);
    const [viewingFormRequest, setViewingFormRequest] = useState<FormRequestData | null>(null);

    // Deep-link from the dashboard: ?form_request=ID auto-opens the fill pane
    // so users land directly on the form they were sent to complete.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestedId = Number(params.get('form_request'));
        if (!requestedId) return;
        const target = pendingFormRequests.find((fr) => fr.id === requestedId);
        if (target && canFillFormRequest(target)) {
            setFillingFormRequest(target);
        }
    }, []);
    const [sendingTestNotification, setSendingTestNotification] = useState(false);
    const [testPopoverOpen, setTestPopoverOpen] = useState(false);
    const [testPhone, setTestPhone] = useState('');

    const [sendOpen, setSendOpen] = useState(false);
    const [sendChannels, setSendChannels] = useState<{ mail: boolean; sms: boolean }>({ mail: true, sms: false });
    const [sendUserIds, setSendUserIds] = useState<number[]>([]);
    const [sendUserFilter, setSendUserFilter] = useState('');
    const [sending, setSending] = useState(false);

    const filteredNotifyUsers = notifyUsers.filter((u) => {
        const q = sendUserFilter.trim().toLowerCase();
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
    });

    const toggleUser = (id: number) => {
        setSendUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const submitSendNotification = () => {
        const channels = Object.entries(sendChannels).filter(([, v]) => v).map(([k]) => k);
        if (channels.length === 0 || sendUserIds.length === 0) return;
        setSending(true);
        router.post(`/injury-register/${injury.id}/send-notification`, { user_ids: sendUserIds, channels }, {
            preserveScroll: true,
            onSuccess: () => { setSendOpen(false); setSendUserIds([]); setSendUserFilter(''); },
            onFinish: () => setSending(false),
        });
    };
    const [commentDoc, setCommentDoc] = useState<JSONContent | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editDoc, setEditDoc] = useState<JSONContent | null>(null);

    const docHasContent = (doc: JSONContent | null) => {
        if (!doc) return false;
        return /"text"|"mention"/.test(JSON.stringify(doc));
    };
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

    const [commentFilter, setCommentFilter] = useState<'all' | 'messages' | 'attachments' | 'history'>('messages');
    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');
    const [preview, setPreview] = useState<AttachmentPreview | null>(null);
    const [removingMediaId, setRemovingMediaId] = useState<number | null>(null);

    function confirmRemoveAttachment() {
        if (removingMediaId === null) return;
        router.delete(`/injury-register/${injury.id}/files/${removingMediaId}`, {
            preserveScroll: true,
            onFinish: () => setRemovingMediaId(null),
        });
    }

    const filteredComments = (() => {
        let result = comments;
        if (commentFilter === 'messages') {
            result = result.filter((c) => c.metadata === null);
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

    const [classifyOpen, setClassifyOpen] = useState(false);
    const [classForm, setClassForm] = useState({
        work_cover_claim: injury.work_cover_claim,
        work_days_missed: injury.work_days_missed,
        report_type: injury.report_type ?? '',
        claim_active: injury.claim_active ?? false,
        claim_type: injury.claim_type ?? '',
        claim_status: injury.claim_status ?? '',
        capacity: injury.capacity ?? '',
        employment_status: injury.employment_status ?? '',
        claim_cost: injury.claim_cost ?? 0,
        days_suitable_duties: injury.days_suitable_duties ?? 0,
        suitable_duties_from: injury.suitable_duties_from ?? '',
        suitable_duties_to: injury.suitable_duties_to ?? '',
        medical_expenses: injury.medical_expenses ?? 0,
    });
    const [classSaving, setClassSaving] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Injury Register', href: '/injury-register' },
        { title: injury.id_formal, href: '#' },
    ];

    function submitClassification() {
        setClassSaving(true);
        router.put(`/injury-register/${injury.id}/classification`, classForm, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setClassSaving(false);
                setClassifyOpen(false);
            },
        });
    }

    const fmtDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleString('en-AU');
    };

    const toDateOnly = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');
    const fmtDateOnly = (d: string | null | undefined) => {
        const iso = toDateOnly(d);
        if (!iso) return '';
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    function handlePostComment() {
        if (!docHasContent(commentDoc) && attachments.length === 0) return;
        setSubmitting(true);
        const formData = new FormData();
        formData.append('commentable_type', 'injury');
        formData.append('commentable_id', String(injury.id));
        if (commentDoc) formData.append('body_json', JSON.stringify(commentDoc));
        attachments.forEach((f) => formData.append('attachments[]', f));
        router.post(route('comments.store'), formData, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => { setCommentDoc(null); setAttachments([]); },
            onFinish: () => setSubmitting(false),
        });
    }

    function handleEditComment(comment: CommentData) {
        setEditingComment(comment);
        setEditDoc(comment.body_json ?? null);
    }

    function submitEditComment() {
        if (!editingComment || !docHasContent(editDoc)) return;
        router.patch(route('comments.update', editingComment.id), { body_json: editDoc }, {
            preserveScroll: true,
            onSuccess: () => setEditingComment(null),
        });
    }

    function handleDeleteComment(commentId: number) {
        setDeletingCommentId(commentId);
    }

    function confirmDeleteComment() {
        if (deletingCommentId === null) return;
        router.delete(route('comments.destroy', deletingCommentId), {
            preserveScroll: true,
            onSuccess: () => setDeletingCommentId(null),
        });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={injury.id_formal} />

            {flash?.success && <SuccessAlertFlash message={flash.success} />}

            <div
                className={cn(
                    'transition-[padding] duration-200',
                    (fillingFormRequest || viewingFormRequest) && 'xl:pr-[520px]',
                )}
            >
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                <Card className="gap-0 overflow-hidden rounded-xl py-0 lg:min-h-[calc(100vh-7rem)]">
                    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
                        {/* Left Column — Activity / Comments */}
                        <div className="flex flex-col">
                            <div className="flex-1 space-y-4 p-5">
                                <div>
                                    <h3 className="text-sm font-semibold">Activity</h3>
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
                                                <ArrowRight className={`h-3 w-3 transition-transform ${commentSort === 'oldest' ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {comments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No activity yet. Post a comment to get started.
                                    </p>
                                ) : filteredComments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No {commentFilter === 'attachments' ? 'attachments' : commentFilter === 'history' ? 'history' : 'messages'} found.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredComments.map((comment) => (
                                            <CommentBubble
                                                key={comment.id}
                                                comment={comment}
                                                currentUserId={currentUserId}
                                                onEdit={handleEditComment}
                                                onDelete={handleDeleteComment}
                                                onPreviewAttachment={setPreview}
                                                onOpenFormResponse={(id) => {
                                                    const fr = formRequests.find((f) => f.id === id);
                                                    if (fr) setViewingFormRequest(fr);
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Comment Input — pinned to bottom */}
                            <div className="mt-auto p-3">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
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
                                                <Button
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={handlePostComment}
                                                    disabled={submitting || (!docHasContent(commentDoc) && attachments.length === 0)}
                                                >
                                                    Update
                                                </Button>
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column — Sidebar */}
                        <div className="bg-muted/40 space-y-4 p-5 max-lg:border-t lg:border-l">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                                <h2 className="text-lg font-semibold">{injury.id_formal}</h2>
                                <div className="flex items-center gap-2">
                                    <InjuryStatusBadge reportType={injury.report_type} label={injury.report_type_label} />
                                    {injury.locked_at && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {can('injury-register.edit') && !injury.locked_at && (
                                    <Button variant="outline" size="sm" className="flex-1" asChild>
                                        <Link href={`/injury-register/${injury.id}/edit`}>
                                            <Pencil className="mr-1 h-3 w-3" /> Edit
                                        </Link>
                                    </Button>
                                )}
                                {can('injury-register.lock') && (
                                    !injury.locked_at ? (
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => router.post(`/injury-register/${injury.id}/lock`, {}, { preserveScroll: true })}>
                                            <Lock className="mr-1 h-3 w-3" /> Lock
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => router.post(`/injury-register/${injury.id}/unlock`, {}, { preserveScroll: true })}>
                                            <Unlock className="mr-1 h-3 w-3" /> Unlock
                                        </Button>
                                    )
                                )}
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => setSendOpen(true)}>
                                    <Send className="mr-1 h-3 w-3" /> Notify
                                </Button>
                                {appEnv !== 'production' && (
                                    <Popover open={testPopoverOpen} onOpenChange={setTestPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" disabled={sendingTestNotification} title="Send a test (dev only)">
                                                <MessageSquare className="h-3 w-3" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-72 space-y-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium">Test SMS to phone</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="tel"
                                                        placeholder="0412 345 678"
                                                        value={testPhone}
                                                        onChange={(e) => setTestPhone(e.target.value)}
                                                        className="h-8 flex-1 text-sm"
                                                        disabled={sendingTestNotification}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8"
                                                        disabled={sendingTestNotification || !testPhone.trim()}
                                                        onClick={() => {
                                                            setSendingTestNotification(true);
                                                            router.post(`/injury-register/${injury.id}/test-notification`, { phone: testPhone }, {
                                                                preserveScroll: true,
                                                                onSuccess: () => { setTestPhone(''); setTestPopoverOpen(false); },
                                                                onFinish: () => setSendingTestNotification(false),
                                                            });
                                                        }}
                                                    >
                                                        Send
                                                    </Button>
                                                </div>
                                            </div>
                                            <Separator />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                disabled={sendingTestNotification}
                                                onClick={() => {
                                                    setSendingTestNotification(true);
                                                    router.post(`/injury-register/${injury.id}/test-notification`, {}, {
                                                        preserveScroll: true,
                                                        onSuccess: () => setTestPopoverOpen(false),
                                                        onFinish: () => setSendingTestNotification(false),
                                                    });
                                                }}
                                            >
                                                <Mail className="mr-1 h-3 w-3" /> Send to my email
                                            </Button>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            {pendingFormRequests.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sign-off</h4>

                                        {pendingFormRequests.map((fr) => {
                                            const fillable = canFillFormRequest(fr);
                                            return (
                                                <div key={fr.id} className="rounded-md border bg-background p-2.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-medium">{fr.form_template?.name ?? 'Form'}</p>
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {fr.assignee_strategy === 'user' && fr.assignee_user_name
                                                                    ? `Assigned to ${fr.assignee_user_name}`
                                                                    : fr.assignee_strategy === 'permission' && fr.assignee_permission
                                                                        ? `Anyone with ${fr.assignee_permission}`
                                                                        : `Awaiting ${fr.recipient_name}`}
                                                            </p>
                                                        </div>
                                                        <Badge variant="secondary" className="shrink-0 text-xs">Pending</Badge>
                                                    </div>
                                                    {fillable && (
                                                        <Button
                                                            size="sm"
                                                            className="mt-2 h-7 w-full text-xs"
                                                            disabled={!fr.form_template?.fields?.length}
                                                            onClick={() => setFillingFormRequest(fr)}
                                                        >
                                                            <ClipboardCheck className="mr-1 h-3 w-3" />
                                                            Sign off
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            <Separator />

                            {/* Incident */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incident</h4>
                                <SidebarField label="Type" value={injury.incident_label} />
                                <SidebarField label="Occurred" value={fmtDate(injury.occurred_at)} />
                                <SidebarField label="Location" value={injury.location?.name} />
                                <SidebarField label="Specific Location" value={injury.location_of_incident} />
                            </div>

                            <Separator />

                            {/* Worker */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Worker</h4>
                                <SidebarField label="Name" value={injury.employee?.preferred_name ?? injury.employee?.name ?? injury.employee_name} />
                                <SidebarField label="Address" value={injury.employee_address} />
                            </div>

                            <Separator />

                            {/* Reporting */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reporting</h4>
                                    {can('injury-register.edit') && (
                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setClassForm({ work_cover_claim: injury.work_cover_claim, work_days_missed: injury.work_days_missed, report_type: injury.report_type ?? '', claim_active: injury.claim_active ?? false, claim_type: injury.claim_type ?? '', claim_status: injury.claim_status ?? '', capacity: injury.capacity ?? '', employment_status: injury.employment_status ?? '', claim_cost: injury.claim_cost ?? 0, days_suitable_duties: injury.days_suitable_duties ?? 0, suitable_duties_from: injury.suitable_duties_from ?? '', suitable_duties_to: injury.suitable_duties_to ?? '', medical_expenses: injury.medical_expenses ?? 0 }); setClassifyOpen(true); }}>
                                            <Pencil className="mr-1 h-3 w-3" /> Edit
                                        </Button>
                                    )}
                                </div>
                                <SidebarField label="Reported By" value={injury.reported_by} />
                                <SidebarField label="Reported At" value={fmtDate(injury.reported_at)} />
                                <SidebarField label="Reported To" value={injury.reported_to} />
                                <SidebarField label="WorkCover Claim" value={injury.work_cover_claim ? 'Yes' : 'No'} />
                                <SidebarField label="Days Lost" value={injury.work_days_missed} />
                                <SidebarField label="Days Suitable Duties" value={injury.computed_suitable_duties_days} />
                                {injury.suitable_duties_from && (
                                    <div className="text-xs text-muted-foreground">
                                        {fmtDateOnly(injury.suitable_duties_from)} → {injury.suitable_duties_to ? fmtDateOnly(injury.suitable_duties_to) : 'ongoing'}
                                    </div>
                                )}
                                {injury.work_cover_claim && (
                                    <>
                                        <SidebarField label="Claim Active" value={injury.claim_active ? 'Yes' : 'No'} />
                                        <SidebarField label="Claim Type" value={injury.claim_type ? (options.claimTypes[injury.claim_type] ?? injury.claim_type) : null} />
                                        <SidebarField label="Claim Status" value={injury.claim_status ? (options.claimStatuses[injury.claim_status] ?? injury.claim_status) : null} />
                                        <SidebarField label="Capacity" value={injury.capacity ? (options.capacities[injury.capacity] ?? injury.capacity) : null} />
                                        <SidebarField label="Employment Status" value={injury.employment_status ? (options.employmentStatuses[injury.employment_status] ?? injury.employment_status) : null} />
                                        <SidebarField label="Claim Cost" value={injury.claim_cost ? `$${Number(injury.claim_cost).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '$0.00'} />
                                    </>
                                )}
                                <SidebarField label="Medical Expenses (Non-WC)" value={injury.medical_expenses ? `$${Number(injury.medical_expenses).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '$0.00'} />
                            </div>

                            <Separator />

                            {/* Treatment */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency & Treatment</h4>
                                <SidebarField label="Emergency Services Called" value={injury.emergency_services ? 'Yes' : 'No'} />
                                {injury.emergency_services && injury.emergency_services_details && (
                                    <SidebarField label="Emergency Details" value={injury.emergency_services_details} />
                                )}
                                <SidebarField label="Treatment Provided" value={injury.treatment === null ? 'N/A' : injury.treatment ? 'Yes' : 'No'} />
                                {injury.treatment && (
                                    <>
                                        <SidebarField label="Type of Treatment" value={injury.treatment_type ? options.treatmentTypes[injury.treatment_type] : 'N/A'} />
                                        {injury.treatment_details && (
                                            <SidebarField label="Treatment Details" value={injury.treatment_details} />
                                        )}
                                    </>
                                )}
                                {injury.treatment === false && injury.no_treatment_reason && (
                                    <SidebarField label="Reason No Treatment" value={injury.no_treatment_reason} />
                                )}
                            </div>

                            {/* Natures / mechanisms etc — compact badges */}
                            {injury.natures && injury.natures.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nature of Injury</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {injury.natures.map((key) => (
                                                <Badge key={key} variant="secondary" className="text-xs">{options.natures[key] ?? key}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {injury.mechanisms && injury.mechanisms.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mechanism</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {injury.mechanisms.map((key) => (
                                                <Badge key={key} variant="secondary" className="text-xs">{options.mechanisms[key] ?? key}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Attached Files */}
                            {injury.media && injury.media.filter((m) => m.collection_name === 'files').length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attached Files</h4>
                                        <div className="space-y-1">
                                            {injury.media
                                                .filter((m) => m.collection_name === 'files')
                                                .map((m) => (
                                                    <div key={m.id} className="flex items-center gap-1 rounded border px-2 py-1.5 text-xs">
                                                        <a href={`/injury-register/${injury.id}/files/${m.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-center gap-2">
                                                            <FileText className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="truncate">{m.file_name}</span>
                                                        </a>
                                                        {can('injury-register.delete') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setRemovingMediaId(m.id)}
                                                                className="text-muted-foreground hover:bg-muted hover:text-red-500 shrink-0 rounded p-0.5 transition-colors"
                                                                aria-label={`Remove ${m.file_name}`}
                                                                title="Remove attachment"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <Separator />

                            {/* Download PDF */}
                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <a href={`/injury-register/${injury.id}/pdf`}>
                                    <Download className="mr-1 h-4 w-4" /> Download Injury Report PDF
                                </a>
                            </Button>

                            {/* Meta */}
                            <div className="space-y-2 pt-2 text-xs">
                                <SidebarField label="Created By" value={injury.creator?.name} />
                                <SidebarField label="Created" value={fmtDate(injury.created_at)} />
                                <SidebarField label="Updated" value={fmtDate(injury.updated_at)} />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
            </div>

            {/* Attachment Preview Dialog */}
            <AttachmentPreviewDialog preview={preview} onClose={() => setPreview(null)} />

            {/* Send Notification Dialog */}
            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
                <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Send Notification — {injury.id_formal}</DialogTitle>
                        <DialogDescription>Pick channels and recipients.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Channels</Label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={sendChannels.mail} onCheckedChange={(v) => setSendChannels((p) => ({ ...p, mail: v === true }))} />
                                    <Mail className="h-3.5 w-3.5" /> Email
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={sendChannels.sms} onCheckedChange={(v) => setSendChannels((p) => ({ ...p, sms: v === true }))} />
                                    <MessageSquare className="h-3.5 w-3.5" /> SMS
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Recipients {sendUserIds.length > 0 && `(${sendUserIds.length})`}
                                </Label>
                                <button
                                    type="button"
                                    onClick={() => setSendUserIds(sendUserIds.length === filteredNotifyUsers.length ? [] : filteredNotifyUsers.map((u) => u.id))}
                                    className="text-primary text-xs hover:underline"
                                >
                                    {sendUserIds.length === filteredNotifyUsers.length && filteredNotifyUsers.length > 0 ? 'Clear all' : 'Select all'}
                                </button>
                            </div>
                            <Input
                                placeholder="Search by name or email…"
                                value={sendUserFilter}
                                onChange={(e) => setSendUserFilter(e.target.value)}
                                className="h-8 text-sm"
                            />
                            <div className="max-h-64 overflow-y-auto rounded-md border">
                                {filteredNotifyUsers.length === 0 ? (
                                    <p className="text-muted-foreground p-3 text-center text-xs">No users match.</p>
                                ) : (
                                    filteredNotifyUsers.map((u) => {
                                        const checked = sendUserIds.includes(u.id);
                                        const smsRequested = sendChannels.sms;
                                        const willGetSms = smsRequested && u.has_sms;
                                        const willGetEmail = sendChannels.mail && !!u.email;
                                        const unreachable = checked && !willGetSms && !willGetEmail;
                                        return (
                                            <label key={u.id} className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                                                <Checkbox checked={checked} onCheckedChange={() => toggleUser(u.id)} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium">{u.name}</div>
                                                    <div className="text-muted-foreground truncate text-xs">
                                                        {u.email ?? 'no email'}
                                                        {smsRequested && (u.has_sms ? ' · SMS ✓' : ' · no mobile')}
                                                    </div>
                                                </div>
                                                {unreachable && <span className="text-amber-600 text-[10px]">unreachable</span>}
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                        <Button
                            onClick={submitSendNotification}
                            disabled={sending || sendUserIds.length === 0 || (!sendChannels.mail && !sendChannels.sms)}
                        >
                            {sending ? 'Sending…' : `Send to ${sendUserIds.length || 0}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Comment Dialog */}
            <Dialog open={editingComment !== null} onOpenChange={(open) => { if (!open) setEditingComment(null); }}>
                <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Edit Comment</DialogTitle>
                        <DialogDescription>Update your comment below.</DialogDescription>
                    </DialogHeader>
                    <AiRichTextEditor
                        outputFormat="json"
                        content={editDoc}
                        onChange={setEditDoc}
                        placeholder="Edit your comment. Use @ to mention someone."
                        enableMentions
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                        <Button onClick={submitEditComment} disabled={!docHasContent(editDoc)}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Classification Dialog */}
            <Dialog open={classifyOpen} onOpenChange={(open) => !open && setClassifyOpen(false)}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Classification & Claims</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                            <Switch
                                checked={classForm.work_cover_claim}
                                onCheckedChange={(v) => setClassForm({ ...classForm, work_cover_claim: v })}
                            />
                            <Label>Was a WorkCover claim submitted?</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Report Type</Label>
                                <Select value={classForm.report_type} onValueChange={(v) => setClassForm({ ...classForm, report_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select report type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(options.reportTypes).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Days Lost</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={classForm.work_days_missed}
                                    onChange={(e) => setClassForm({ ...classForm, work_days_missed: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Suitable Duties Period</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">From</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={`w-full justify-start text-left font-normal ${!classForm.suitable_duties_from ? 'text-muted-foreground' : ''}`}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {classForm.suitable_duties_from ? fmtDateOnly(classForm.suitable_duties_from) : 'Pick a date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={toDateOnly(classForm.suitable_duties_from) ? new Date(toDateOnly(classForm.suitable_duties_from) + 'T00:00:00') : undefined}
                                                onSelect={(date) => setClassForm({ ...classForm, suitable_duties_from: date ? date.toLocaleDateString('en-CA') : '' })}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">To (empty = ongoing)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={`w-full justify-start text-left font-normal ${!classForm.suitable_duties_to ? 'text-muted-foreground' : ''}`}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {classForm.suitable_duties_to ? fmtDateOnly(classForm.suitable_duties_to) : 'Pick a date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={toDateOnly(classForm.suitable_duties_to) ? new Date(toDateOnly(classForm.suitable_duties_to) + 'T00:00:00') : undefined}
                                                onSelect={(date) => setClassForm({ ...classForm, suitable_duties_to: date ? date.toLocaleDateString('en-CA') : '' })}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {classForm.work_cover_claim && (
                            <>
                                <Separator />
                                <h4 className="text-sm font-semibold">Claim Details</h4>
                                <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                                    <Switch
                                        checked={classForm.claim_active}
                                        onCheckedChange={(v) => setClassForm({ ...classForm, claim_active: v })}
                                    />
                                    <Label>Claim Active</Label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Claim Type</Label>
                                        <Select value={classForm.claim_type} onValueChange={(v) => setClassForm({ ...classForm, claim_type: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(options.claimTypes).map(([key, label]) => (
                                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Claim Status</Label>
                                        <Select value={classForm.claim_status} onValueChange={(v) => setClassForm({ ...classForm, claim_status: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(options.claimStatuses).map(([key, label]) => (
                                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Capacity</Label>
                                        <Select value={classForm.capacity} onValueChange={(v) => setClassForm({ ...classForm, capacity: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select capacity" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(options.capacities).map(([key, label]) => (
                                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Employment Status</Label>
                                        <Select value={classForm.employment_status} onValueChange={(v) => setClassForm({ ...classForm, employment_status: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(options.employmentStatuses).map(([key, label]) => (
                                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Claim Cost ($)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={classForm.claim_cost}
                                        onChange={(e) => setClassForm({ ...classForm, claim_cost: parseFloat(e.target.value) || 0 })}
                                        className="w-40"
                                    />
                                </div>
                            </>
                        )}

                        <Separator />
                        <div className="space-y-2">
                            <Label>Medical Expenses — Non WorkCover ($)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={classForm.medical_expenses}
                                onChange={(e) => setClassForm({ ...classForm, medical_expenses: parseFloat(e.target.value) || 0 })}
                                className="w-40"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClassifyOpen(false)}>Cancel</Button>
                        <Button onClick={submitClassification} disabled={classSaving}>
                            {classSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Comment Confirmation */}
            <Dialog open={deletingCommentId !== null} onOpenChange={(open) => { if (!open) setDeletingCommentId(null); }}>
                <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Delete Comment</DialogTitle>
                        <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingCommentId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteComment}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Attachment Confirmation */}
            <Dialog open={removingMediaId !== null} onOpenChange={(open) => { if (!open) setRemovingMediaId(null); }}>
                <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Remove Attachment</DialogTitle>
                        <DialogDescription>
                            This will hide the attachment from the injury record. The file is retained and can be restored by an admin.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemovingMediaId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmRemoveAttachment}>Remove</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FormFillPane
                formRequest={fillingFormRequest}
                onClose={() => setFillingFormRequest(null)}
            />

            <FormResponsePane
                formRequest={viewingFormRequest}
                onClose={() => setViewingFormRequest(null)}
            />
        </AppLayout>
    );
}

import { SuccessAlertFlash } from '@/components/alert-flash';
import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryFormOptions } from '@/types/injury';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Activity, ArrowRight, CalendarIcon, Download, File as FileIcon, FileImage, FileText, Loader2, Lock, Mail, MessageSquare, Paperclip, Pencil, Send, Trash2, Unlock } from 'lucide-react';
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
    metadata: Record<string, unknown> | null;
    user: { id: number; name: string } | null;
    created_at: string;
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
    const iconColor = 'text-muted-foreground';
    const typeLabel = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : (attachment.mime_type.split('/')[1] ?? 'File').toUpperCase();

    return (
        <div className="hover:border-foreground/30 group flex w-44 flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all hover:shadow-md">
            <button
                type="button"
                onClick={() => onPreview(attachment)}
                className="bg-muted/40 relative flex h-32 items-center justify-center overflow-hidden border-b"
            >
                {kind === 'pdf' && <PdfThumbnail url={attachment.url} />}
                {kind === 'image' && (
                    <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                )}
                {kind === 'other' && <Icon className="text-muted-foreground h-12 w-12" />}
                <div className="absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/5" />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
                <button
                    type="button"
                    onClick={() => onPreview(attachment)}
                    className="min-w-0 flex-1 text-left"
                >
                    <div className="truncate text-xs font-medium leading-tight">{attachment.file_name}</div>
                    <div className="text-muted-foreground text-[9px] uppercase tracking-wide">{typeLabel}</div>
                </button>
                <a
                    href={attachment.url}
                    download={attachment.file_name}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded p-1 transition-colors"
                    aria-label={`Download ${attachment.file_name}`}
                    title="Download"
                >
                    <Download className="h-3.5 w-3.5" />
                </a>
            </div>
        </div>
    );
}

function AttachmentList({ attachments, onPreview, compact = false }: { attachments: Attachment[]; onPreview: (a: Attachment) => void; compact?: boolean }) {
    if (attachments.length === 0) return null;
    return (
        <div className={`flex flex-wrap gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
            {attachments.map((att) => (
                <AttachmentCard key={att.id} attachment={att} onPreview={onPreview} />
            ))}
        </div>
    );
}

function AttachmentPreviewDialog({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
    const open = attachment !== null;
    const kind = attachment ? attachmentKind(attachment.mime_type) : 'other';

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent
                className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="border-b px-4 py-3 pr-12 space-y-0">
                    <DialogTitle className="truncate text-sm font-medium">{attachment?.file_name}</DialogTitle>
                </DialogHeader>
                <div className="bg-muted/30 flex-1 overflow-auto">
                    {attachment && kind === 'pdf' && (
                        <iframe src={attachment.url} title={attachment.file_name} className="h-full w-full bg-white" />
                    )}
                    {attachment && kind === 'image' && (
                        <div className="flex h-full items-center justify-center p-4">
                            <img src={attachment.url} alt={attachment.file_name} className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    {attachment && kind === 'other' && (
                        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm">
                            <FileIcon className="h-12 w-12 opacity-50" />
                            <p>No preview available for this file type.</p>
                            <Button variant="outline" size="sm" asChild>
                                <a href={attachment.url} target="_blank" rel="noopener noreferrer" download={attachment.file_name}>
                                    <Download className="mr-1 h-3.5 w-3.5" /> Download
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
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

function SystemComment({ comment, onPreviewAttachment }: { comment: CommentData; onPreviewAttachment: (a: Attachment) => void }) {
    const event = (comment.metadata as Record<string, unknown>)?.event as string | undefined;

    return (
        <div className="flex items-start gap-3">
            <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                {event === 'locked' ? (
                    <Lock className="h-3 w-3 text-amber-500" />
                ) : event === 'unlocked' ? (
                    <Unlock className="h-3 w-3 text-green-500" />
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
                <AttachmentList attachments={comment.attachments} onPreview={onPreviewAttachment} compact />
            </div>
        </div>
    );
}

function CommentBubble({ comment, currentUserId, onEdit, onDelete, onPreviewAttachment }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
    onPreviewAttachment: (a: Attachment) => void;
}) {
    if (comment.metadata) {
        return <SystemComment comment={comment} onPreviewAttachment={onPreviewAttachment} />;
    }

    const isOwner = currentUserId !== undefined && comment.user?.id === currentUserId;
    const hasAttachments = comment.attachments.length > 0;

    return (
        <div className="flex gap-3">
            {comment.user ? (
                <UserAvatar name={comment.user.name} />
            ) : (
                <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs">S</div>
            )}
            <div className={`min-w-0 flex-1 ${hasAttachments ? 'border-muted-foreground/30 border-l pl-3' : ''}`}>
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
                {comment.body && <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>}
                <AttachmentList attachments={comment.attachments} onPreview={onPreviewAttachment} />
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 pl-4">
                        {comment.replies.map((reply) => (
                            <CommentBubble key={reply.id} comment={reply} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} onPreviewAttachment={onPreviewAttachment} />
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

export default function InjuryShow({ injury, comments, options, notifyUsers }: Props) {
    const pageProps = usePage().props;
    const auth = pageProps.auth as { user?: { id: number }; permissions?: string[] };
    const flash = pageProps.flash as { success?: string } | undefined;
    const appEnv = pageProps.appEnv as string;
    const currentUserId = auth?.user?.id;
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);
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
    const [commentBody, setCommentBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editBody, setEditBody] = useState('');
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

    const [commentFilter, setCommentFilter] = useState<'all' | 'messages' | 'attachments' | 'history'>('all');
    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

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
        if (!commentBody.trim() && attachments.length === 0) return;
        setSubmitting(true);
        const formData = new FormData();
        formData.append('commentable_type', 'injury');
        formData.append('commentable_id', String(injury.id));
        formData.append('body', commentBody);
        attachments.forEach((f) => formData.append('attachments[]', f));
        router.post(route('comments.store'), formData, {
            preserveScroll: true,
            onSuccess: () => { setCommentBody(''); setAttachments([]); },
            onFinish: () => setSubmitting(false),
        });
    }

    function handleEditComment(comment: CommentData) {
        setEditingComment(comment);
        setEditBody(comment.body);
    }

    function submitEditComment() {
        if (!editingComment || !editBody.trim()) return;
        router.patch(route('comments.update', editingComment.id), { body: editBody }, {
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
                                                onPreviewAttachment={setPreviewAttachment}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Comment Input — pinned to bottom */}
                            <div className="mt-auto border-t p-3">
                                {attachments.length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        {attachments.map((file, i) => (
                                            <div key={i} className="bg-muted flex items-center gap-1.5 rounded px-2 py-1 text-xs">
                                                <FileText className="h-3 w-3" />
                                                <span className="max-w-[120px] truncate">{file.name}</span>
                                                <button type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { setAttachments([...attachments, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
                                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" type="button" onClick={() => fileInputRef.current?.click()}>
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
                                    <Button size="icon" className="h-10 w-10 shrink-0" onClick={handlePostComment} disabled={submitting || (!commentBody.trim() && attachments.length === 0)}>
                                        <Send className="h-4 w-4" />
                                    </Button>
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
                                                    <a key={m.id} href={`/injury-register/${injury.id}/files/${m.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate">{m.file_name}</span>
                                                    </a>
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

            {/* Attachment Preview Dialog */}
            <AttachmentPreviewDialog attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />

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
                    <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                        <Button onClick={submitEditComment} disabled={!editBody.trim()}>Save</Button>
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
        </AppLayout>
    );
}

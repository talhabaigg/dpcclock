import { SuccessAlertFlash } from '@/components/alert-flash';
import { CommentBody, type MentionedUser } from '@/components/comments/comment-body';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import type { JSONContent } from '@tiptap/react';
import {
    ArrowRight,
    Check,
    Copy,
    Download,
    EllipsisVertical,
    ExternalLink,
    File as FileIcon,
    FileImage,
    FileSignature,
    FileText,
    Lock,
    Paperclip,
    Pencil,
    QrCode,
    Send,
    Trash2,
    Unlock,
    Upload,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';

interface MediaItem {
    id: number;
    file_name: string;
    original_url: string;
    collection_name: string;
}

interface Talk {
    id: string;
    meeting_date: string;
    meeting_date_formatted: string;
    meeting_subject: string;
    is_locked: boolean;
    key_topics: { description: string }[] | null;
    action_points: { description: string }[] | null;
    injuries: { description: string }[] | null;
    near_misses: { description: string }[] | null;
    floor_comments: { description: string }[] | null;
    location: { id: number; name: string } | null;
    called_by: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    media: MediaItem[];
}

interface SignatureRow {
    id: number;
    employee: { id: number; name: string; preferred_name: string | null } | null;
    signed_at: string | null;
    source: string | null;
    signature: string | null;
}

interface SignedPdf {
    id: number;
    file_name: string;
    url: string;
}

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
    mentioned_users?: MentionedUser[];
    attachments: Attachment[];
    replies?: CommentData[];
}

interface Props {
    talk: Talk;
    signatures: SignatureRow[];
    signedPdf: SignedPdf | null;
    subjectOptions: Record<string, string>;
    generalItems: string[];
    signInUrl: string;
    ipadUrl: string;
    comments: CommentData[];
}

function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try {
            await navigator.clipboard?.writeText(value);
        } catch {
            /* swallow */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };
    return (
        <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2.5">
            <label className="text-sm font-medium text-muted-foreground">{label}</label>
            <Input value={value} readOnly className="font-mono text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={onCopy} className="min-w-[76px] gap-1.5">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy'}
            </Button>
        </div>
    );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
            <div className="text-sm font-medium text-foreground">{children}</div>
        </div>
    );
}

function highlightMust(text: string) {
    return text.split(/(\bMUST\b)/g).map((part, i) =>
        part === 'MUST' ? (
            <strong key={i} className="font-semibold text-foreground">
                {part}
            </strong>
        ) : (
            <Fragment key={i}>{part}</Fragment>
        ),
    );
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

function AttachmentCard({ attachment, onPreview }: { attachment: Attachment; onPreview: (a: Attachment) => void }) {
    const kind = attachmentKind(attachment.mime_type);
    const Icon = kind === 'pdf' ? FileText : kind === 'image' ? FileImage : FileIcon;
    const typeLabel = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : (attachment.mime_type.split('/')[1] ?? 'File').toUpperCase();

    return (
        <div className="hover:border-foreground/30 group flex w-44 flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all hover:shadow-md">
            <button
                type="button"
                onClick={() => onPreview(attachment)}
                className="bg-muted/40 relative flex h-32 items-center justify-center overflow-hidden border-b"
            >
                {kind === 'image' ? (
                    <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                ) : (
                    <Icon className="text-muted-foreground h-12 w-12" />
                )}
                <div className="absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/5" />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
                <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
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

function AttachmentList({ attachments, onPreview }: { attachments: Attachment[]; onPreview: (a: Attachment) => void }) {
    if (attachments.length === 0) return null;
    return (
        <div className="mt-2 flex flex-wrap gap-2">
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
            <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                <DialogHeader className="space-y-0 border-b px-4 py-3 pr-12">
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

function CommentBubble({ comment, currentUserId, onEdit, onDelete, onPreviewAttachment }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
    onPreviewAttachment: (a: Attachment) => void;
}) {
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
                    {comment.attachments.length > 0 && (
                        <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
                            <Paperclip className="h-2.5 w-2.5" />
                            {comment.attachments.length}
                        </span>
                    )}
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
                <AttachmentList attachments={comment.attachments} onPreview={onPreviewAttachment} />
            </div>
        </div>
    );
}

export default function ToolboxTalkShow({ talk, signatures, signedPdf, subjectOptions, generalItems, signInUrl, ipadUrl, comments }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { user?: { id: number }; permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { user?: { id: number }; permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const currentUserId = auth?.user?.id;
    const can = (p: string) => permissions.includes(p);

    const topicFiles = talk.media.filter((m) => m.collection_name === 'topic_files');
    const actionPointFiles = talk.media.filter((m) => m.collection_name === 'action_point_files');
    const injuryFiles = talk.media.filter((m) => m.collection_name === 'injury_files');
    const nearMissFiles = talk.media.filter((m) => m.collection_name === 'near_miss_files');
    const floorCommentFiles = talk.media.filter((m) => m.collection_name === 'floor_comment_files');

    const [commentDoc, setCommentDoc] = useState<JSONContent | null>(null);
    const [commentAttachments, setCommentAttachments] = useState<File[]>([]);
    const [postingComment, setPostingComment] = useState(false);

    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editDoc, setEditDoc] = useState<JSONContent | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
    const [activeSection, setActiveSection] = useState<string>('content');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const docHasContent = (doc: JSONContent | null) => {
        if (!doc) return false;
        return /"text"|"mention"/.test(JSON.stringify(doc));
    };

    const sortedComments = useMemo(() => {
        return commentSort === 'newest' ? [...comments].reverse() : comments;
    }, [comments, commentSort]);

    function handlePostComment() {
        if (!docHasContent(commentDoc) && commentAttachments.length === 0) return;
        setPostingComment(true);
        const formData = new FormData();
        formData.append('commentable_type', 'toolbox_talk');
        formData.append('commentable_id', String(talk.id));
        if (commentDoc) formData.append('body_json', JSON.stringify(commentDoc));
        commentAttachments.forEach((f) => formData.append('attachments[]', f));
        router.post(route('comments.store'), formData, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => { setCommentDoc(null); setCommentAttachments([]); },
            onFinish: () => setPostingComment(false),
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

    function confirmDeleteComment() {
        if (deletingCommentId === null) return;
        router.delete(route('comments.destroy', deletingCommentId), {
            preserveScroll: true,
            onSuccess: () => setDeletingCommentId(null),
        });
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Toolbox Talks', href: '/toolbox-talks' },
        { title: talk.location?.name ?? 'Toolbox Talk', href: '/toolbox-talks' },
        { title: talk.meeting_date_formatted, href: '#' },
    ];

    const sectionLinks: { id: string; label: string; count?: number }[] = [
        { id: 'content', label: 'Content' },
        { id: 'comments', label: 'Comments', count: comments.length },
        { id: 'signed', label: 'Signed', count: signatures.length },
    ];

    const showSection = (id: string) => {
        setActiveSection(id);
        history.replaceState(null, '', `#${id}`);
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    // Deep-link: respect #section or ?comment=N (notifications open Comments).
    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        const params = new URLSearchParams(window.location.search);
        const targetId = hash || (params.has('comment') ? 'comments' : null);
        if (!targetId) return;
        if (!sectionLinks.some((s) => s.id === targetId)) return;
        setActiveSection(targetId);

    }, []);

    const confirmDelete = () => {
        router.delete(`/toolbox-talks/${talk.id}`, {
            onFinish: () => setShowDeleteConfirm(false),
        });
    };

    const actionsMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    Actions
                    <EllipsisVertical className="ml-1.5 h-3.5 w-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                {can('prestarts.edit') && !talk.is_locked && (
                    <DropdownMenuItem asChild>
                        <Link href={`/toolbox-talks/${talk.id}/edit`}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <a href={`/toolbox-talks/${talk.id}/pdf`} target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Download PDF
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <a href={`/toolbox-talks/${talk.id}/sign-sheet`} target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Sign Sheet
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <a href={`/toolbox-talks/${talk.id}/qr-sheet`} target="_blank" rel="noreferrer">
                        <QrCode className="mr-2 h-3.5 w-3.5" />
                        Print QR
                    </a>
                </DropdownMenuItem>
                {can('prestarts.edit') && (
                    <DropdownMenuItem asChild>
                        <Link href={`/toolbox-talks/${talk.id}/upload-signatures`}>
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            Upload Signatures
                        </Link>
                    </DropdownMenuItem>
                )}
                {can('prestarts.edit') && (
                    <DropdownMenuItem
                        onClick={() => router.post(`/toolbox-talks/${talk.id}/${talk.is_locked ? 'unlock' : 'lock'}`, {}, { preserveScroll: true })}
                    >
                        {talk.is_locked ? <Unlock className="mr-2 h-3.5 w-3.5" /> : <Lock className="mr-2 h-3.5 w-3.5" />}
                        {talk.is_locked ? 'Unlock' : 'Lock'}
                    </DropdownMenuItem>
                )}
                {can('prestarts.delete') && !talk.is_locked && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const activeSectionMeta = sectionLinks.find((s) => s.id === activeSection);
    const activeSectionLabel = activeSectionMeta?.label ?? '';
    const activeSectionCount = activeSectionMeta?.count;

    const renderFiles = (files: MediaItem[]) =>
        files.length > 0 && (
            <div className="mt-2 space-y-1">
                {files.map((m) => (
                    <a key={m.id} href={m.original_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                        {m.file_name}
                    </a>
                ))}
            </div>
        );

    const renderList = (title: string, items: { description: string }[] | null, files: MediaItem[]) =>
        items && items.length > 0 ? (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">{title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                    <ul className="space-y-2">
                        {items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                                <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-muted-foreground" />
                                <span>{item.description}</span>
                            </li>
                        ))}
                    </ul>
                    {renderFiles(files)}
                </CardContent>
            </Card>
        ) : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Toolbox Talk - ${talk.meeting_date_formatted}`} />
            <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Toolbox Talk</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete the toolbox talk for {talk.meeting_date_formatted}? This will also delete all signatures.</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Section nav + content grid */}
                <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
                    <nav
                        aria-label="Sections"
                        className="lg:sticky lg:top-4 lg:self-start"
                    >
                        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
                            {sectionLinks.map((s) => {
                                const active = activeSection === s.id;
                                return (
                                    <li key={s.id} className="shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => showSection(s.id)}
                                            className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                                                active
                                                    ? 'bg-muted text-foreground font-medium'
                                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                            }`}
                                        >
                                            <span>{s.label}</span>
                                            {typeof s.count === 'number' && (
                                                <span className={`text-xs ${active ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                                                    {s.count}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="min-w-0 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <h2 className="text-base font-semibold">
                                    {activeSectionLabel}
                                    {typeof activeSectionCount === 'number' && (
                                        <span className="text-muted-foreground ml-1.5 font-normal">({activeSectionCount})</span>
                                    )}
                                </h2>
                                {activeSection === 'signed' && signedPdf && (
                                    <a
                                        href={signedPdf.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                        title={signedPdf.file_name}
                                    >
                                        <FileSignature className="size-3.5 shrink-0 text-muted-foreground" />
                                        <span className="max-w-[220px] truncate">{signedPdf.file_name}</span>
                                        <Download className="size-3 shrink-0 text-muted-foreground" />
                                    </a>
                                )}
                            </div>
                            {actionsMenu}
                        </div>

                        {/* Content */}
                        <section id="content" className="space-y-4" hidden={activeSection !== 'content'}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                {talk.called_by && (
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">Called by: </span>
                                        <span className="font-medium">{talk.called_by.name}</span>
                                    </p>
                                )}
                                <div className="flex items-center gap-1.5">
                                    {talk.is_locked && <Badge variant="outline">Locked</Badge>}
                                    {!talk.is_locked && (
                                        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                                            <span className="size-1.5 rounded-full bg-emerald-600" />
                                            Active
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Worker Sign-In */}
                            <div className="grid items-start gap-6 sm:grid-cols-[200px_1fr]">
                                <div className="w-fit rounded-xl border border-border bg-background p-3 shadow-[0_1px_0_rgba(15,17,21,0.02)]">
                                    <QRCodeSVG value={signInUrl} size={176} level="M" />
                                </div>
                                <div className="flex flex-col gap-3">
                                    <p className="m-0 max-w-[480px] text-[13.5px] leading-snug text-muted-foreground">
                                        Workers scan this code to sign in via their phone. Or open the link directly on a shared iPad.
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        <CopyField label="Mobile" value={signInUrl} />
                                        <CopyField label="iPad" value={ipadUrl} />
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" asChild>
                                            <a href={`/toolbox-talks/${talk.id}/qr-sheet`} target="_blank" rel="noreferrer">
                                                <QrCode className="size-3.5" />
                                                Printable QR Sheet
                                            </a>
                                        </Button>
                                        <Button size="sm" variant="outline" asChild>
                                            <a href={ipadUrl} target="_blank" rel="noreferrer">
                                                <ExternalLink className="size-3.5" />
                                                Open on iPad
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Details */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Details</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                                        <DetailField label="Project">
                                            {talk.location ? (
                                                <Link
                                                    href={`/locations/${talk.location.id}`}
                                                    className="text-foreground hover:text-primary hover:underline"
                                                >
                                                    {talk.location.name}
                                                </Link>
                                            ) : (
                                                '-'
                                            )}
                                        </DetailField>
                                        <DetailField label="Meeting Called By">
                                            {talk.called_by ? (
                                                <Link
                                                    href={`/users/edit/${talk.called_by.id}`}
                                                    className="group inline-flex items-center gap-2 text-foreground hover:text-primary"
                                                >
                                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                                        {talk.called_by.name
                                                            .split(' ')
                                                            .map((n) => n[0])
                                                            .join('')
                                                            .slice(0, 2)
                                                            .toUpperCase()}
                                                    </span>
                                                    <span className="group-hover:underline">{talk.called_by.name}</span>
                                                </Link>
                                            ) : (
                                                '-'
                                            )}
                                        </DetailField>
                                        <DetailField label="Subject">
                                            <Badge variant="outline">{subjectOptions[talk.meeting_subject] ?? talk.meeting_subject}</Badge>
                                        </DetailField>
                                        <DetailField label="Status">
                                            {talk.is_locked ? (
                                                <Badge variant="secondary">Closed</Badge>
                                            ) : (
                                                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                    <span className="size-1.5 rounded-full bg-emerald-600" />
                                                    Active
                                                </span>
                                            )}
                                        </DetailField>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* General Items */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">General Items to be Discussed</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <ul className="space-y-2">
                                        {generalItems.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                                                <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-muted-foreground" />
                                                <span>{highlightMust(item)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            {renderList('Key Topics Arising on Site', talk.key_topics, topicFiles)}
                            {renderList('Action Points from Last Meeting', talk.action_points, actionPointFiles)}
                            {renderList('Injuries from Previous Week', talk.injuries, injuryFiles)}
                            {renderList('Near Misses from Previous Week', talk.near_misses, nearMissFiles)}
                            {renderList('Comments from the Floor', talk.floor_comments, floorCommentFiles)}
                        </section>

                        {/* Comments */}
                        <section id="comments" className="space-y-4" hidden={activeSection !== 'comments'}>
                            <AiRichTextEditor
                                outputFormat="json"
                                content={commentDoc}
                                onChange={setCommentDoc}
                                placeholder="Type a message. Use @ to mention someone."
                                enableAttachments
                                enableMentions
                                collapseToolbar
                                attachments={commentAttachments}
                                onAttachmentsChange={setCommentAttachments}
                                trailingActions={
                                    <Button
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={handlePostComment}
                                        disabled={postingComment || (!docHasContent(commentDoc) && commentAttachments.length === 0)}
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                        Send
                                    </Button>
                                }
                            />

                            {comments.length === 0 ? (
                                <p className="text-muted-foreground py-4 text-center text-sm italic">
                                    No comments yet.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            className="text-primary flex items-center gap-1 text-xs font-medium"
                                            onClick={() => setCommentSort((s) => (s === 'oldest' ? 'newest' : 'oldest'))}
                                        >
                                            {commentSort === 'oldest' ? 'Oldest first' : 'Newest first'}
                                            <ArrowRight className={`h-3 w-3 transition-transform ${commentSort === 'oldest' ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {sortedComments.map((comment) => (
                                            <CommentBubble
                                                key={comment.id}
                                                comment={comment}
                                                currentUserId={currentUserId}
                                                onEdit={handleEditComment}
                                                onDelete={(id) => setDeletingCommentId(id)}
                                                onPreviewAttachment={setPreviewAttachment}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Signed */}
                        <section id="signed" className="space-y-4" hidden={activeSection !== 'signed'}>
                            {signatures.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No worker signatures yet.</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Signed At</TableHead>
                                                <TableHead>Signature</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {signatures.map((sig) => {
                                                const displayName = sig.employee?.preferred_name || sig.employee?.name || '-';
                                                return (
                                                <TableRow key={sig.id}>
                                                    <TableCell>
                                                        {sig.employee ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                                                    {displayName
                                                                        .split(' ')
                                                                        .map((n) => n[0])
                                                                        .join('')
                                                                        .slice(0, 2)
                                                                        .toUpperCase()}
                                                                </span>
                                                                <span>{displayName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{sig.signed_at ? new Date(sig.signed_at).toLocaleString('en-AU') : '-'}</TableCell>
                                                    <TableCell>
                                                        {sig.signature ? (
                                                            <img
                                                                src={sig.signature}
                                                                alt="Signature"
                                                                className="h-10 max-w-[200px] object-contain dark:invert"
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Not available</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* Edit comment dialog */}
                <Dialog open={editingComment !== null} onOpenChange={(o) => { if (!o) setEditingComment(null); }}>
                    <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle>Edit comment</DialogTitle>
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

                {/* Delete comment confirm */}
                <Dialog open={deletingCommentId !== null} onOpenChange={(o) => { if (!o) setDeletingCommentId(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete comment</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete this comment? This cannot be undone.</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeletingCommentId(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmDeleteComment}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Attachment preview */}
                <AttachmentPreviewDialog attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
            </div>
        </AppLayout>
    );
}

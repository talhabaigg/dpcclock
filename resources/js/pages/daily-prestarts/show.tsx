import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import WeatherWidget from '@/components/weather-widget';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CheckCircle2, Download, File as FileIcon, FileImage, FileText, GraduationCap, Lock, MessageSquare, Paperclip, Pencil, Send, Trash2, Unlock } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

interface MediaItem {
    id: number;
    file_name: string;
    original_url: string;
    collection_name: string;
}

interface Signature {
    id: number;
    signature: string;
    signed_at: string;
    employee: { id: number; name: string; preferred_name: string | null } | null;
}

interface UnsignedEmployee {
    id: number;
    name: string;
    is_present_at_site: boolean;
    absence_reason: string | null;
    reason_label: string | null;
    reason_value: string | null;
    note: string | null;
    clock_in_time: string | null;
    updated_by_name: string | null;
    updated_at: string | null;
}

interface Prestart {
    id: string;
    work_date: string;
    work_date_formatted: string;
    weather: Record<string, unknown> | null;
    activities: { description: string }[] | null;
    safety_concerns: { description: string }[] | null;
    is_active: boolean;
    is_locked: boolean;
    location: { id: number; name: string } | null;
    foreman: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    signatures: Signature[];
    media: MediaItem[];
}

interface TrainingItem {
    id: number;
    title: string;
    time: string | null;
    room: string | null;
    notes: string | null;
    employees: { id: number; name: string; preferred_name: string | null; display_name: string }[];
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
    metadata: Record<string, unknown> | null;
    user: { id: number; name: string } | null;
    created_at: string;
    attachments: Attachment[];
    replies?: CommentData[];
}

interface Props {
    prestart: Prestart;
    unsignedEmployees: UnsignedEmployee[];
    trainings: TrainingItem[];
    reasonOptions: Record<string, string>;
    comments: CommentData[];
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
                {comment.body && <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>}
                <AttachmentList attachments={comment.attachments} onPreview={onPreviewAttachment} />
            </div>
        </div>
    );
}

const DAILY_CHECKLIST = [
    "Today's trade specific works discussed and understood",
    'All SWMS reviewed and understood',
    'Work permits in place as required and conditions understood',
    'Tools and equipment in working order with Test & Tag up to date',
    'Required PPE available and fit for purpose',
    'Current Licences & Qualifications are relevant to work tasks',
];

export default function DailyPrestartShow({ prestart, unsignedEmployees, trainings, reasonOptions, comments }: Props) {
    const { auth } = usePage<{ auth: { user?: { id: number }; permissions?: string[] } }>().props as { auth: { user?: { id: number }; permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const currentUserId = auth?.user?.id;
    const can = (p: string) => permissions.includes(p);

    const [commentBody, setCommentBody] = useState('');
    const [commentAttachments, setCommentAttachments] = useState<File[]>([]);
    const [postingComment, setPostingComment] = useState(false);
    const commentFileInputRef = useRef<HTMLInputElement>(null);

    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editCommentBody, setEditCommentBody] = useState('');
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

    const sortedComments = useMemo(() => {
        return commentSort === 'newest' ? [...comments].reverse() : comments;
    }, [comments, commentSort]);

    function handlePostComment() {
        if (!commentBody.trim() && commentAttachments.length === 0) return;
        setPostingComment(true);
        const formData = new FormData();
        formData.append('commentable_type', 'daily_prestart');
        formData.append('commentable_id', String(prestart.id));
        formData.append('body', commentBody);
        commentAttachments.forEach((f) => formData.append('attachments[]', f));
        router.post(route('comments.store'), formData, {
            preserveScroll: true,
            onSuccess: () => { setCommentBody(''); setCommentAttachments([]); },
            onFinish: () => setPostingComment(false),
        });
    }

    function handleEditComment(comment: CommentData) {
        setEditingComment(comment);
        setEditCommentBody(comment.body);
    }

    function submitEditComment() {
        if (!editingComment || !editCommentBody.trim()) return;
        router.patch(route('comments.update', editingComment.id), { body: editCommentBody }, {
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

    const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
    const [noteText, setNoteText] = useState('');
    const [reasonValue, setReasonValue] = useState<string>('none');
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [sortBy, setSortBy] = useState<'name' | 'status'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [bulkReason, setBulkReason] = useState<string>('none');
    const [bulkNote, setBulkNote] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);

    const statusRank = (e: UnsignedEmployee) => {
        if (e.is_present_at_site) return 0;
        if (e.absence_reason) return 1;
        return 2;
    };

    const sortedUnsigned = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...unsignedEmployees].sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name) * dir;
            }
            const ra = statusRank(a);
            const rb = statusRank(b);
            if (ra !== rb) return (ra - rb) * dir;
            return (a.absence_reason ?? '').localeCompare(b.absence_reason ?? '') * dir;
        });
    }, [unsignedEmployees, sortBy, sortDir]);

    const toggleSort = (col: 'name' | 'status') => {
        if (sortBy === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('asc');
        }
    };

    const toggleSelected = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const allVisibleSelected = sortedUnsigned.length > 0 && sortedUnsigned.every((e) => selectedIds.has(e.id));
    const toggleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sortedUnsigned.map((e) => e.id)));
        }
    };

    const openBulkDialog = () => {
        setBulkReason('none');
        setBulkNote('');
        setBulkDialogOpen(true);
    };

    const saveBulk = () => {
        if (selectedIds.size === 0) return;
        router.post(
            route('daily-prestarts.bulk-update-absence-note', { dailyPrestart: prestart.id }),
            {
                employee_ids: Array.from(selectedIds),
                reason: bulkReason === 'none' ? null : bulkReason,
                note: bulkNote || null,
            },
            {
                onBefore: () => setBulkSaving(true),
                onSuccess: () => {
                    setBulkDialogOpen(false);
                    setSelectedIds(new Set());
                    setBulkReason('none');
                    setBulkNote('');
                },
                onFinish: () => setBulkSaving(false),
                preserveScroll: true,
            }
        );
    };

    const confirmDelete = () => {
        router.delete(`/daily-prestarts/${prestart.id}`, {
            onFinish: () => setShowDeleteConfirm(false),
        });
    };

    const openNoteEditor = (employee: UnsignedEmployee) => {
        setEditingEmployeeId(employee.id);
        setNoteText(employee.note ?? '');
        setReasonValue(employee.reason_value ?? 'none');
    };

    const saveNote = () => {
        if (editingEmployeeId === null) return;

        router.post(
            route('daily-prestarts.update-absence-note', { dailyPrestart: prestart.id, employee: editingEmployeeId }),
            {
                reason: reasonValue === 'none' ? null : reasonValue,
                note: noteText || null,
            },
            {
                onBefore: () => setIsSaving(true),
                onSuccess: () => {
                    setEditingEmployeeId(null);
                    setNoteText('');
                    setReasonValue('none');
                },
                onFinish: () => setIsSaving(false),
                preserveScroll: true,
            }
        );
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Daily Prestarts', href: '/daily-prestarts' },
        { title: prestart.location?.name ?? 'Prestart', href: '/daily-prestarts' },
        { title: prestart.work_date_formatted ?? prestart.work_date, href: '#' },
    ];

    const activityMedia = prestart.media.filter((m) => m.collection_name === 'activity_files');
    const safetyConcernMedia = prestart.media.filter((m) => m.collection_name === 'safety_concern_files');
    const buildersPrestartMedia = prestart.media.filter((m) => m.collection_name === 'builders_prestart_file');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Prestart - ${prestart.location?.name ?? ''} ${prestart.work_date_formatted ?? prestart.work_date}`} />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Daily Prestart</h1>
                        <p className="text-muted-foreground text-sm">
                            {prestart.location?.name ?? '-'} &middot; {prestart.work_date_formatted ?? prestart.work_date}
                            {prestart.foreman && <> &middot; {prestart.foreman.name}</>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {prestart.is_locked && <Badge variant="outline">Locked</Badge>}
                        <Badge variant={prestart.is_active ? 'default' : 'secondary'}>{prestart.is_active ? 'Active' : 'Inactive'}</Badge>
                        {can('prestarts.edit') && !prestart.is_locked && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/daily-prestarts/${prestart.id}/edit`}>
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/daily-prestarts/${prestart.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                PDF
                            </a>
                        </Button>
                        {can('prestarts.edit') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.post(`/daily-prestarts/${prestart.id}/${prestart.is_locked ? 'unlock' : 'lock'}`, {}, { preserveScroll: true })}
                            >
                                {prestart.is_locked ? <Unlock className="mr-1.5 h-3.5 w-3.5" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}
                                {prestart.is_locked ? 'Unlock' : 'Lock'}
                            </Button>
                        )}
                        {can('prestarts.delete') && !prestart.is_locked && (
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete
                            </Button>
                        )}
                    </div>
                </div>

                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Prestart</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete the prestart for {prestart.work_date_formatted ?? prestart.work_date}? This will also delete all signatures.</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Weather */}
                <WeatherWidget weather={prestart.weather as any} workDate={prestart.work_date} />

                {/* Comments / Activity */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Comments
                        </CardTitle>
                        {comments.length > 0 && (
                            <button
                                type="button"
                                className="text-primary flex items-center gap-1 text-xs font-medium"
                                onClick={() => setCommentSort((s) => (s === 'oldest' ? 'newest' : 'oldest'))}
                            >
                                {commentSort === 'oldest' ? 'Oldest first' : 'Newest first'}
                                <ArrowRight className={`h-3 w-3 transition-transform ${commentSort === 'oldest' ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                            </button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Comment Input — above activity, like injuries */}
                        <div>
                            {commentAttachments.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                    {commentAttachments.map((file, i) => (
                                        <div key={i} className="bg-muted flex items-center gap-1.5 rounded px-2 py-1 text-xs">
                                            <FileText className="h-3 w-3" />
                                            <span className="max-w-[120px] truncate">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setCommentAttachments(commentAttachments.filter((_, j) => j !== i))}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-end gap-2">
                                <input
                                    ref={commentFileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        setCommentAttachments([...commentAttachments, ...Array.from(e.target.files ?? [])]);
                                        e.target.value = '';
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    type="button"
                                    onClick={() => commentFileInputRef.current?.click()}
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
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={handlePostComment}
                                    disabled={postingComment || (!commentBody.trim() && commentAttachments.length === 0)}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {comments.length === 0 ? (
                            <p className="text-muted-foreground py-4 text-center text-sm italic">
                                No comments yet.
                            </p>
                        ) : (
                            <div className="space-y-4 border-t pt-4">
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
                        )}
                    </CardContent>
                </Card>

                {/* Activities */}
                {prestart.activities && prestart.activities.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>General Site Works / Activities</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc space-y-1 pl-5">
                                {prestart.activities.map((a, i) => (
                                    <li key={i}>{a.description}</li>
                                ))}
                            </ul>
                            {activityMedia.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-muted-foreground mb-2 text-sm font-medium">Attached Files</h4>
                                    <div className="space-y-1">
                                        {activityMedia.map((m) => (
                                            <a
                                                key={m.id}
                                                href={m.original_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-sm text-blue-600 hover:underline"
                                            >
                                                {m.file_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Daily Checklist */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Checklist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-2">
                            {DAILY_CHECKLIST.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>

                {/* Safety Concerns */}
                {prestart.safety_concerns && prestart.safety_concerns.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Safety Concerns / Incidents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc space-y-1 pl-5">
                                {prestart.safety_concerns.map((s, i) => (
                                    <li key={i}>{s.description}</li>
                                ))}
                            </ul>
                            {safetyConcernMedia.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-muted-foreground mb-2 text-sm font-medium">Attached Files</h4>
                                    <div className="space-y-1">
                                        {safetyConcernMedia.map((m) => (
                                            <a
                                                key={m.id}
                                                href={m.original_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-sm text-blue-600 hover:underline"
                                            >
                                                {m.file_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Trainings */}
                {trainings && trainings.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5" />
                                Training Booked
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {trainings.map((t) => (
                                <div key={t.id} className="rounded-lg border p-3">
                                    <p className="font-medium">
                                        {t.title}
                                        {t.time && <span className="text-muted-foreground"> at {t.time}</span>}
                                    </p>
                                    {t.room && <p className="text-muted-foreground text-sm">{t.room}</p>}
                                    {t.employees.length > 0 && (
                                        <p className="mt-1 text-sm">
                                            {t.employees.map((e) => e.display_name || e.preferred_name || e.name).join(', ')}
                                        </p>
                                    )}
                                    {t.notes && <p className="text-muted-foreground mt-1 text-sm italic">{t.notes}</p>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Builders Prestart Files */}
                {buildersPrestartMedia.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Builders Daily Pre-Start</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                {buildersPrestartMedia.map((m) => (
                                    <a
                                        key={m.id}
                                        href={m.original_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block text-sm text-blue-600 hover:underline"
                                    >
                                        {m.file_name}
                                    </a>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Unsigned Employees */}
                {unsignedEmployees.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-base font-semibold">Not Signed ({unsignedEmployees.length})</h2>
                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">{selectedIds.size} selected</span>
                                    <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                                        Clear
                                    </Button>
                                    <Button size="sm" onClick={openBulkDialog}>
                                        Apply Reason / Note
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={allVisibleSelected}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                            />
                                        </TableHead>
                                        <TableHead>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 font-medium hover:text-slate-900"
                                                onClick={() => toggleSort('name')}
                                            >
                                                Employee
                                                {sortBy === 'name' ? (
                                                    sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </button>
                                        </TableHead>
                                        <TableHead>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 font-medium hover:text-slate-900"
                                                onClick={() => toggleSort('status')}
                                            >
                                                Status
                                                {sortBy === 'status' ? (
                                                    sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </button>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedUnsigned.map((emp) => (
                                        <TableRow key={emp.id} data-selected={selectedIds.has(emp.id) ? 'true' : undefined}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(emp.id)}
                                                    onCheckedChange={() => toggleSelected(emp.id)}
                                                    aria-label={`Select ${emp.name}`}
                                                />
                                            </TableCell>
                                                <TableCell>{emp.name}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {emp.is_present_at_site ? (
                                                                    <Badge variant="outline">Present - Not Signed</Badge>
                                                                ) : emp.absence_reason && !(emp.reason_label && emp.absence_reason === 'Absent (Unexplained)') ? (
                                                                    <Badge variant="outline">{emp.absence_reason}</Badge>
                                                                ) : !emp.reason_label ? (
                                                                    <Badge variant="outline">No Record</Badge>
                                                                ) : null}
                                                                {emp.clock_in_time && (
                                                                    <span className="text-muted-foreground text-xs">at {emp.clock_in_time}</span>
                                                                )}
                                                                {emp.reason_label && (
                                                                    <Badge variant="secondary">{emp.reason_label}</Badge>
                                                                )}
                                                            </div>
                                                            {editingEmployeeId === emp.id && (
                                                                <Popover open={true} onOpenChange={(open) => !open && setEditingEmployeeId(null)}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0"
                                                                        >
                                                                            <MessageSquare className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-80" side="left">
                                                                        <div className="space-y-3">
                                                                            <h4 className="font-medium text-sm">Absence Reason & Note</h4>
                                                                            <div className="space-y-1.5">
                                                                                <label className="text-xs font-medium text-slate-600">Reason</label>
                                                                                <Select value={reasonValue} onValueChange={setReasonValue}>
                                                                                    <SelectTrigger className="w-full">
                                                                                        <SelectValue placeholder="Select reason" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="none">No reason set</SelectItem>
                                                                                        {Object.entries(reasonOptions).map(([key, label]) => (
                                                                                            <SelectItem key={key} value={key}>
                                                                                                {label}
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                <label className="text-xs font-medium text-slate-600">Note</label>
                                                                                <Textarea
                                                                                    placeholder="e.g., 2 days at MAR01 (discussed with supervisor)"
                                                                                    value={noteText}
                                                                                    onChange={(e) => setNoteText(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                                                            e.preventDefault();
                                                                                            saveNote();
                                                                                        }
                                                                                    }}
                                                                                    className="min-h-20 text-sm"
                                                                                />
                                                                            </div>
                                                                            <div className="flex justify-end gap-2">
                                                                                <Button variant="outline" size="sm" onClick={() => setEditingEmployeeId(null)} disabled={isSaving}>
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button size="sm" onClick={saveNote} disabled={isSaving}>
                                                                                    {isSaving ? 'Saving...' : 'Save'}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                            {editingEmployeeId !== emp.id && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => openNoteEditor(emp)}
                                                                    className="h-6 w-6 p-0"
                                                                >
                                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {emp.note && (
                                                            <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                                                                {emp.note}
                                                            </div>
                                                        )}
                                                        {emp.updated_by_name && (emp.note || emp.reason_label) && (
                                                            <p className="text-[11px] text-slate-500">
                                                                by {emp.updated_by_name}
                                                                {emp.updated_at && <> · {emp.updated_at}</>}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {/* Bulk apply reason/note dialog */}
                <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Apply Reason / Note to {selectedIds.size} {selectedIds.size === 1 ? 'worker' : 'workers'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Reason</label>
                                <Select value={bulkReason} onValueChange={setBulkReason}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No reason set</SelectItem>
                                        {Object.entries(reasonOptions).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Note</label>
                                <Textarea
                                    placeholder="Optional note applied to all selected workers"
                                    value={bulkNote}
                                    onChange={(e) => setBulkNote(e.target.value)}
                                    className="min-h-20 text-sm"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                This will overwrite any existing reason/note for the selected workers.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkSaving}>Cancel</Button>
                            <Button onClick={saveBulk} disabled={bulkSaving}>
                                {bulkSaving ? 'Saving...' : 'Apply'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit comment dialog */}
                <Dialog open={editingComment !== null} onOpenChange={(o) => { if (!o) setEditingComment(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit comment</DialogTitle>
                        </DialogHeader>
                        <Textarea
                            value={editCommentBody}
                            onChange={(e) => setEditCommentBody(e.target.value)}
                            className="min-h-24"
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                            <Button onClick={submitEditComment} disabled={!editCommentBody.trim()}>Save</Button>
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

                {/* Signatures */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold">Signatures ({prestart.signatures.length})</h2>
                    {prestart.signatures.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No signatures yet.</p>
                    ) : (
                        <>
                            {/* Desktop / tablet: full 3-column table */}
                            <div className="hidden rounded-md border sm:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Signed At</TableHead>
                                            <TableHead>Signature</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {prestart.signatures.map((sig) => (
                                            <TableRow key={sig.id}>
                                                <TableCell>{sig.employee?.preferred_name || sig.employee?.name || '-'}</TableCell>
                                                <TableCell>{new Date(sig.signed_at).toLocaleString('en-AU')}</TableCell>
                                                <TableCell>
                                                    <img
                                                        src={sig.signature}
                                                        alt="Signature"
                                                        className="h-10 max-w-[200px] object-contain dark:invert"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile: 2-column collapsed view (name+time / signature) */}
                            <div className="divide-y rounded-md border sm:hidden">
                                {prestart.signatures.map((sig) => (
                                    <div key={sig.id} className="grid grid-cols-2 items-center gap-2 p-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">
                                                {sig.employee?.preferred_name || sig.employee?.name || '-'}
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                {new Date(sig.signed_at).toLocaleString('en-AU')}
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <img
                                                src={sig.signature}
                                                alt="Signature"
                                                className="h-10 max-w-full object-contain dark:invert"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

        </AppLayout>
    );
}

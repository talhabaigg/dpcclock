import { PhotoAnnotationOverlay, type PhotoAnnotationData } from '@/components/annotations/photo-annotations';
import { CommentBody, type MentionedUser } from '@/components/comments/comment-body';
import { DatePickerDemo } from '@/components/date-picker';
import {
    CategoryCode,
    ChecklistSection,
    describeError,
    EmployeeMultiPicker,
    InitialsAvatar,
    LinksSection,
    TaskStatusControl,
} from '@/components/site-tasks/task-sections';
import { pinMetaFor, type CategoryOption, type ChecklistTemplateOption, type EmployeeOption, type SiteTaskDto } from '@/components/site-tasks/types';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { router } from '@inertiajs/react';
import type { JSONContent } from '@tiptap/core';
import { format } from 'date-fns';
import { Download, MapPin, MessageSquare, Paperclip, PenLine, Send, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const PhotoAnnotationEditor = lazy(() => import('@/components/annotations/photo-annotation-editor'));

type CommentAttachment = {
    id: number;
    file_name: string;
    url: string;
    mime_type: string;
    annotations?: PhotoAnnotationData | null;
    annotations_url?: string;
};

/** An attachment opened in the preview/annotation dialog. */
type AttachmentPreview = { attachment: CommentAttachment; streamUrl: string };

type CommentData = {
    id: number;
    body: string | null;
    body_json: JSONContent | null;
    user: { id: number; name: string } | null;
    created_at: string;
    mentioned_users: MentionedUser[];
    attachments: CommentAttachment[];
    replies?: CommentData[];
};

type PinPreview = {
    drawing_id: number;
    page_number: number;
    x: number;
    y: number;
    drawing: { id: number; sheet_number: string | null; display_name: string; thumbnail_url: string | null } | null;
};

type TaskDetail = { task: SiteTaskDto; comments: CommentData[]; pin?: PinPreview | null };

/**
 * Master–detail task dialog: comments/activity in the main pane, task
 * details (status, assignees, due date) in the right rail, with the QA /
 * rectification / work-tracker sections above the activity feed.
 */
export function SiteTaskDialog({
    taskId,
    open,
    onOpenChange,
    canEdit,
    onChanged,
    onOpenTask,
}: {
    taskId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canEdit: boolean;
    onChanged: () => void;
    /** Navigate the dialog to another task (drill into a linked task / back to parent). */
    onOpenTask?: (taskId: number) => void;
}) {
    const [detail, setDetail] = useState<TaskDetail | null>(null);
    const [loading, setLoading] = useState(false);
    // Annotations saved this session, keyed by media id — thumbnails and the
    // preview reflect edits without waiting for a refetch.
    const [annotationOverrides, setAnnotationOverrides] = useState<Record<number, PhotoAnnotationData>>({});
    const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [templates, setTemplates] = useState<ChecklistTemplateOption[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);

    const loadDetail = useCallback(async () => {
        if (!taskId) return;
        try {
            const res = await api.get<TaskDetail>(`/site-tasks/${taskId}`);
            setDetail(res);
        } catch (e) {
            toast.error(describeError(e));
        }
    }, [taskId]);

    useEffect(() => {
        if (!open || !taskId) {
            setDetail(null);
            return;
        }
        setLoading(true);
        void loadDetail().finally(() => setLoading(false));
    }, [open, taskId, loadDetail]);

    // Picker options refresh on every open so newly seeded templates or
    // employees never leave the pickers stale/greyed out.
    useEffect(() => {
        if (!open) return;
        api.get<{ templates: ChecklistTemplateOption[] }>('/site-task-checklist-templates')
            .then((res) => setTemplates(res.templates))
            .catch((e) => toast.error(describeError(e)));
        api.get<{ categories: CategoryOption[] }>('/site-task-categories')
            .then((res) => setCategories(res.categories))
            .catch(() => {});
    }, [open]);

    // Assignee options are the task's project kiosk roster, so they wait for
    // the detail (and its location_id) to load.
    const locationId = detail?.task.location_id;
    useEffect(() => {
        if (!open || !locationId) return;
        api.get<{ employees: EmployeeOption[] }>('/site-task-employees', { params: { project: locationId } })
            .then((res) => setEmployees(res.employees))
            .catch((e) => toast.error(describeError(e)));
    }, [open, locationId]);

    const refresh = useCallback(() => {
        void loadDetail();
        onChanged();
    }, [loadDetail, onChanged]);

    const task = detail?.task ?? null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl" showCloseButton={false}>
                {/* Header */}
                <DialogHeader className="shrink-0 border-b px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        {task && (
                            <span title={task.category?.name}>
                                <CategoryCode
                                    category={{ code: pinMetaFor(task).label, color: pinMetaFor(task).color }}
                                    className="h-6 w-6 text-[9px]"
                                />
                            </span>
                        )}
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-sm">
                                {task ? <InlineTitle task={task} canEdit={canEdit} onChanged={refresh} /> : 'Task'}
                            </DialogTitle>
                            {task?.parent && (
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => onOpenTask?.(task.parent!.id)}
                                    className="text-muted-foreground h-auto p-0 text-[10px]"
                                >
                                    in {task.parent.title}
                                </Button>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" onClick={() => onOpenChange(false)} aria-label="Close">
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </DialogHeader>

                {loading || !task ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Spinner className="h-5 w-5" />
                    </div>
                ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_250px]">
                        {/* Main — content sections + activity */}
                        <div className="flex min-h-0 flex-col">
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="space-y-4 p-4">
                                    {task.description && <p className="text-muted-foreground text-xs whitespace-pre-wrap">{task.description}</p>}

                                    {task.parent_id === null && (
                                        <>
                                            <ChecklistSection
                                                task={task}
                                                templates={templates}
                                                employees={employees}
                                                canEdit={canEdit}
                                                onChanged={refresh}
                                                onOpenTask={onOpenTask}
                                            />
                                            <Separator />
                                            <LinksSection unit={task} canEdit={canEdit} onChanged={refresh} onOpenTask={onOpenTask} />
                                            <Separator />
                                        </>
                                    )}

                                    <CommentsThread
                                        comments={detail?.comments ?? []}
                                        annotationOverrides={annotationOverrides}
                                        onPreview={setAttachmentPreview}
                                    />
                                </div>
                            </ScrollArea>

                            {canEdit && <CommentComposer taskId={task.id} onPosted={refresh} />}
                        </div>

                        {/* Right rail — task details; pin preview pinned to the bottom */}
                        <div className="bg-muted/30 flex flex-col gap-4 overflow-y-auto border-t p-4 md:border-t-0 md:border-l">
                            <DetailRow label="Status">
                                <TaskStatusControl task={task} canEdit={canEdit} onChanged={refresh} />
                            </DetailRow>

                            <DetailRow label="Assignees">
                                <div className="space-y-1.5">
                                    {(task.assignees ?? []).map((a) => (
                                        <div key={a.id} className="flex items-center gap-1.5 text-xs">
                                            {/* Work-tracker phases complete person by person. */}
                                            {task.category?.code === 'WT' && canEdit && (
                                                <span title={`Mark ${a.employee?.name ?? 'worker'} as done`} className="flex items-center">
                                                    <Checkbox
                                                        checked={a.completed_at !== null}
                                                        onCheckedChange={async (checked) => {
                                                            try {
                                                                await api.patch(`/site-tasks/${task.id}/assignees/${a.id}/completion`, {
                                                                    completed: checked === true,
                                                                });
                                                                refresh();
                                                            } catch (e) {
                                                                toast.error(describeError(e));
                                                            }
                                                        }}
                                                        aria-label={`Mark ${a.employee?.name ?? 'worker'} as done`}
                                                    />
                                                </span>
                                            )}
                                            <InitialsAvatar name={a.employee?.name} done={a.completed_at !== null} />
                                            <span className={a.completed_at ? 'text-muted-foreground' : undefined}>
                                                {a.employee?.name ?? `Employee #${a.employee_id}`}
                                            </span>
                                            {a.completed_at && task.category?.code === 'WT' && (
                                                <span className="text-muted-foreground text-[9px]">{format(new Date(a.completed_at), 'dd MMM')}</span>
                                            )}
                                        </div>
                                    ))}
                                    {(task.assignees ?? []).length === 0 && <p className="text-muted-foreground text-[11px]">Unassigned</p>}
                                    {canEdit && (
                                        <EmployeeMultiPicker
                                            employees={employees}
                                            selected={(task.assignees ?? []).map((a) => a.employee_id)}
                                            onChange={async (ids) => {
                                                try {
                                                    await api.post(`/site-tasks/${task.id}/assignees`, { employee_ids: ids });
                                                    refresh();
                                                } catch (e) {
                                                    toast.error(describeError(e));
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            </DetailRow>

                            <DetailRow label="Due date">
                                {canEdit ? (
                                    <DatePickerDemo
                                        value={task.due_date ? new Date(task.due_date) : undefined}
                                        onChange={async (date) => {
                                            try {
                                                await api.patch(`/site-tasks/${task.id}`, {
                                                    due_date: date ? format(date, 'yyyy-MM-dd') : null,
                                                });
                                                refresh();
                                            } catch (e) {
                                                toast.error(describeError(e));
                                            }
                                        }}
                                    />
                                ) : (
                                    <span className="text-xs">{task.due_date ? format(new Date(task.due_date), 'dd MMM yyyy') : '—'}</span>
                                )}
                            </DetailRow>

                            <DetailRow label="Category">
                                {canEdit ? (
                                    <Select
                                        value={task.category_id ? String(task.category_id) : ''}
                                        onValueChange={async (categoryId) => {
                                            try {
                                                await api.patch(`/site-tasks/${task.id}`, { category_id: Number(categoryId) });
                                                refresh();
                                            } catch (e) {
                                                toast.error(describeError(e));
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-7 w-full rounded-sm text-[11px]">
                                            <SelectValue placeholder="Pick category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                                                    <span className="flex items-center gap-1.5">
                                                        <CategoryCode category={c} />
                                                        {c.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Badge variant="outline" className="text-[10px]">
                                        {task.category?.name ?? '—'}
                                    </Badge>
                                )}
                            </DetailRow>

                            {detail?.pin?.drawing?.thumbnail_url && (
                                <div className="bg-background mt-auto overflow-hidden rounded-md border">
                                    <div className="relative">
                                        <img
                                            src={detail.pin.drawing.thumbnail_url}
                                            alt={detail.pin.drawing.display_name}
                                            className="w-full object-contain dark:brightness-90 dark:invert"
                                        />
                                        <MapPin
                                            aria-hidden
                                            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-full drop-shadow-md"
                                            style={{
                                                left: `${detail.pin.x * 100}%`,
                                                top: `${detail.pin.y * 100}%`,
                                                color: pinMetaFor(task).color,
                                                fill: 'currentColor',
                                            }}
                                        />
                                    </div>
                                    <div className="border-t px-2 py-1.5">
                                        {detail.pin.drawing.sheet_number && (
                                            <div className="text-xs font-semibold">{detail.pin.drawing.sheet_number}</div>
                                        )}
                                        <div className="text-muted-foreground truncate text-[10px]">{detail.pin.drawing.display_name}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            <AttachmentPreviewDialog
                preview={attachmentPreview}
                canEdit={canEdit}
                annotations={
                    attachmentPreview
                        ? attachmentPreview.attachment.id in annotationOverrides
                            ? annotationOverrides[attachmentPreview.attachment.id]
                            : (attachmentPreview.attachment.annotations ?? null)
                        : null
                }
                onClose={() => setAttachmentPreview(null)}
                onSaved={(mediaId, data) => setAnnotationOverrides((prev) => ({ ...prev, [mediaId]: data }))}
            />
        </Dialog>
    );
}

/** Image preview with markup: arrows, freehand, text — saved onto the attachment. */
function AttachmentPreviewDialog({
    preview,
    canEdit,
    annotations,
    onClose,
    onSaved,
}: {
    preview: AttachmentPreview | null;
    canEdit: boolean;
    annotations: PhotoAnnotationData | null;
    onClose: () => void;
    onSaved: (mediaId: number, data: PhotoAnnotationData) => void;
}) {
    const [annotating, setAnnotating] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setAnnotating(false);
    }, [preview?.attachment.id]);

    const save = (data: PhotoAnnotationData) => {
        const url = preview?.attachment.annotations_url;
        const mediaId = preview?.attachment.id;
        if (!url || mediaId === undefined) return;
        setSaving(true);
        const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error((err as { message?: string } | null)?.message ?? 'Failed to save annotations.');
                }
                onSaved(mediaId, data);
                setAnnotating(false);
            })
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to save annotations.'))
            .finally(() => setSaving(false));
    };

    return (
        <Dialog open={preview !== null} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={false}>
                <DialogHeader className="shrink-0 border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="min-w-0 flex-1 truncate text-xs">{preview?.attachment.file_name}</DialogTitle>
                        {canEdit && preview?.attachment.annotations_url && !annotating && (
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAnnotating(true)}>
                                <PenLine className="h-3.5 w-3.5" />
                                Annotate
                            </Button>
                        )}
                        {preview && (
                            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download">
                                <a href={preview.streamUrl} download={preview.attachment.file_name} target="_blank" rel="noreferrer">
                                    <Download className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close preview">
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </DialogHeader>

                {preview &&
                    (annotating ? (
                        <Suspense
                            fallback={
                                <div className="flex h-[60vh] items-center justify-center">
                                    <Spinner className="h-5 w-5" />
                                </div>
                            }
                        >
                            <PhotoAnnotationEditor
                                key={preview.attachment.id}
                                src={preview.streamUrl}
                                initial={annotations}
                                saving={saving}
                                onSave={save}
                                onCancel={() => setAnnotating(false)}
                            />
                        </Suspense>
                    ) : (
                        <div className="min-h-0 flex-1 overflow-auto bg-neutral-950/5 p-2 dark:bg-neutral-50/5">
                            <div className="relative mx-auto w-fit">
                                <img src={preview.streamUrl} alt={preview.attachment.file_name} className="max-h-[70vh] rounded" />
                                <span className="pointer-events-none absolute inset-0">
                                    <PhotoAnnotationOverlay data={annotations} />
                                </span>
                            </div>
                        </div>
                    ))}
            </DialogContent>
        </Dialog>
    );
}

/** Click-to-edit task title. Saves on Enter/blur, Esc cancels. */
function InlineTitle({ task, canEdit, onChanged }: { task: SiteTaskDto; canEdit: boolean; onChanged: () => void }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(task.title);

    // A different task (or an outside rename) resets the draft. Freshly
    // dropped pins ("New pin") start in edit mode so naming is one keystroke away.
    useEffect(() => {
        setValue(task.title);
        setEditing(canEdit && task.title === 'New pin');
    }, [task.id, task.title, canEdit]);

    const save = async () => {
        const title = value.trim();
        setEditing(false);
        if (!title || title === task.title) {
            setValue(task.title);
            return;
        }
        try {
            await api.patch(`/site-tasks/${task.id}`, { title });
            onChanged();
        } catch (e) {
            toast.error(describeError(e));
            setValue(task.title);
        }
    };

    if (!canEdit) {
        return <span className="block truncate">{task.title}</span>;
    }

    if (editing) {
        return (
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void save();
                    }
                    if (e.key === 'Escape') {
                        setValue(task.title);
                        setEditing(false);
                    }
                }}
                autoFocus
                className="h-7 text-sm font-semibold"
            />
        );
    }

    return (
        <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="-mx-1 block h-auto w-full cursor-text justify-start truncate rounded px-1 py-0.5 text-left text-sm font-semibold"
        >
            {task.title}
        </Button>
    );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase">{label}</div>
            {children}
        </div>
    );
}

// ── Comments ──────────────────────────────────────────────────

function CommentsThread({
    comments,
    annotationOverrides,
    onPreview,
}: {
    comments: CommentData[];
    annotationOverrides: Record<number, PhotoAnnotationData>;
    onPreview: (preview: AttachmentPreview) => void;
}) {
    return (
        <section>
            <div className="mb-2 flex items-center gap-1.5">
                <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
                <h3 className="text-xs font-semibold">Comments</h3>
                <span className="text-muted-foreground text-[10px] tabular-nums">{comments.length}</span>
            </div>

            {comments.length === 0 && <p className="text-muted-foreground text-[11px] italic">No comments yet.</p>}

            <div className="space-y-3">
                {comments.map((comment) => (
                    <div key={comment.id}>
                        <CommentItem comment={comment} annotationOverrides={annotationOverrides} onPreview={onPreview} />
                        {(comment.replies ?? []).length > 0 && (
                            <div className="border-muted mt-2 space-y-2 border-l-2 pl-3">
                                {comment.replies!.map((reply) => (
                                    <CommentItem key={reply.id} comment={reply} annotationOverrides={annotationOverrides} onPreview={onPreview} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}

function CommentItem({
    comment,
    annotationOverrides,
    onPreview,
}: {
    comment: CommentData;
    annotationOverrides: Record<number, PhotoAnnotationData>;
    onPreview: (preview: AttachmentPreview) => void;
}) {
    const images = comment.attachments.filter((a) => a.mime_type?.startsWith('image/'));
    const files = comment.attachments.filter((a) => !a.mime_type?.startsWith('image/'));

    return (
        <div className="flex gap-2">
            <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">
                {(comment.user?.name ?? '?')
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium">{comment.user?.name ?? 'Unknown'}</span>
                    <span className="text-muted-foreground text-[10px]">{format(new Date(comment.created_at), 'dd MMM yyyy HH:mm')}</span>
                </div>
                <CommentBody doc={comment.body_json} fallback={comment.body ?? ''} mentionedUsers={comment.mentioned_users} className="text-xs" />
                {images.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {images.map((img) => {
                            const streamUrl = `/comments/${comment.id}/attachments/${img.id}`;
                            const annotations = img.id in annotationOverrides ? annotationOverrides[img.id] : (img.annotations ?? null);
                            return (
                                <Button
                                    key={img.id}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onPreview({ attachment: img, streamUrl })}
                                    title={`Open ${img.file_name}`}
                                    className="coarse:h-24 coarse:w-24 relative h-20 w-20 overflow-hidden rounded border p-0"
                                >
                                    <img src={streamUrl} alt={img.file_name} className="absolute inset-0 h-full w-full object-cover" />
                                    <span className="pointer-events-none absolute inset-0">
                                        <PhotoAnnotationOverlay data={annotations} fit="cover" />
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                )}
                {files.map((f) => (
                    <a
                        key={f.id}
                        href={`/comments/${comment.id}/attachments/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary mt-1 flex items-center gap-1 text-[11px] hover:underline"
                    >
                        <Paperclip className="h-3 w-3" />
                        {f.file_name}
                    </a>
                ))}
            </div>
        </div>
    );
}

function CommentComposer({ taskId, onPosted }: { taskId: number; onPosted: () => void }) {
    const [doc, setDoc] = useState<JSONContent | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [posting, setPosting] = useState(false);

    const hasContent = (d: JSONContent | null) => d != null && /"text"|"mention"/.test(JSON.stringify(d));

    const post = () => {
        if (!hasContent(doc) && attachments.length === 0) return;
        setPosting(true);

        const formData = new FormData();
        formData.append('commentable_type', 'site_task');
        formData.append('commentable_id', String(taskId));
        if (doc) formData.append('body_json', JSON.stringify(doc));
        attachments.forEach((file) => formData.append('attachments[]', file));

        router.post('/comments', formData, {
            preserveScroll: true,
            preserveState: true,
            forceFormData: true,
            onSuccess: () => {
                setDoc(null);
                setAttachments([]);
                onPosted();
            },
            onError: () => toast.error('Failed to post comment'),
            onFinish: () => setPosting(false),
        });
    };

    return (
        <div className="shrink-0 border-t p-3">
            <AiRichTextEditor
                outputFormat="json"
                content={doc}
                onChange={setDoc}
                placeholder="Add a comment… @ to mention"
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
                        onClick={post}
                        disabled={posting || (!hasContent(doc) && attachments.length === 0)}
                        title="Post comment"
                    >
                        {posting ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                }
            />
        </div>
    );
}

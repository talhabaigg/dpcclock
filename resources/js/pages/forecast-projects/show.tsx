import { SuccessAlertFlash } from '@/components/alert-flash';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Activity, Archive, ArrowRight, FileText, Paperclip, Pencil, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs = (project: Project): BreadcrumbItem[] => [
    { title: 'Turnover Forecast', href: '/turnover-forecast' },
    { title: 'Forecast Projects', href: '/forecast-projects' },
    { title: project.project_number, href: `/forecast-projects/${project.id}` },
];

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
    attachments?: Attachment[];
    replies?: CommentData[];
}

interface Project {
    id: number;
    name: string;
    project_number: string;
    company?: string | null;
    description?: string | null;
    status: 'potential' | 'likely' | 'confirmed' | 'cancelled';
    start_date?: string | null;
    end_date?: string | null;
    total_revenue_forecast: number;
    total_cost_budget: number;
    created_at: string;
    updated_at: string;
    created_by_name?: string | null;
    updated_by_name?: string | null;
    archived_at?: string | null;
    archived_by_name?: string | null;
}

interface Props {
    project: Project;
    comments: CommentData[];
}

const currency = (value: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);

const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function UserAvatar({ name }: { name: string }) {
    const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    return (
        <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            {initials}
        </div>
    );
}

function SystemComment({ comment }: { comment: CommentData }) {
    return (
        <div className="flex items-start gap-3">
            <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                <Activity className="text-muted-foreground h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">{comment.user?.name ?? 'System'}</span>
                    <span className="text-muted-foreground text-xs">
                        {new Date(comment.created_at).toLocaleString('en-AU')}
                    </span>
                </div>
                {comment.body && (
                    <p
                        className="text-muted-foreground mt-0.5 whitespace-pre-wrap text-xs"
                        dangerouslySetInnerHTML={{
                            __html: comment.body.replace(
                                /\*\*(.+?)\*\*/g,
                                '<strong class="text-foreground font-medium">$1</strong>',
                            ),
                        }}
                    />
                )}
            </div>
        </div>
    );
}

function CommentBubble({
    comment,
    currentUserId,
    onEdit,
    onDelete,
}: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
}) {
    if (comment.metadata) return <SystemComment comment={comment} />;

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
                    <span className="text-muted-foreground text-xs">
                        {new Date(comment.created_at).toLocaleString('en-AU')}
                    </span>
                    {isOwner && (
                        <div className="ml-auto flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit?.(comment)}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500"
                                onClick={() => onDelete?.(comment.id)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
                {comment.body && <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>}
                {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {comment.attachments.map((att) => (
                            <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
                            >
                                <FileText className="h-3 w-3" /> {att.file_name}
                            </a>
                        ))}
                    </div>
                )}
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 pl-4">
                        {comment.replies.map((reply) => (
                            <CommentBubble
                                key={reply.id}
                                comment={reply}
                                currentUserId={currentUserId}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
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

const STATUS_LABELS: Record<Project['status'], string> = {
    potential: 'Potential',
    likely: 'Likely',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
};

export default function ForecastProjectShow({ project, comments }: Props) {
    const pageProps = usePage().props;
    const auth = pageProps.auth as { user?: { id: number } };
    const flash = pageProps.flash as { success?: string } | undefined;
    const currentUserId = auth?.user?.id;

    const [commentBody, setCommentBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editBody, setEditBody] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePost = () => {
        if (!commentBody.trim() && attachments.length === 0) return;
        setSubmitting(true);

        const formData = new FormData();
        formData.append('commentable_type', 'forecast_project');
        formData.append('commentable_id', String(project.id));
        formData.append('body', commentBody);
        attachments.forEach((file) => formData.append('attachments[]', file));

        router.post('/comments', formData, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setCommentBody('');
                setAttachments([]);
            },
            onFinish: () => setSubmitting(false),
        });
    };

    const handleEditStart = (comment: CommentData) => {
        setEditingComment(comment);
        setEditBody(comment.body);
    };

    const handleEditSave = () => {
        if (!editingComment || !editBody.trim()) return;
        router.patch(
            `/comments/${editingComment.id}`,
            { body: editBody },
            {
                preserveScroll: true,
                onSuccess: () => setEditingComment(null),
            },
        );
    };

    const handleDelete = (commentId: number) => {
        if (!confirm('Delete this comment?')) return;
        router.delete(`/comments/${commentId}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs(project)}>
            <Head title={`${project.project_number} — ${project.name}`} />

            {flash?.success && <SuccessAlertFlash message={flash.success} />}

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                <Card className="gap-0 overflow-hidden rounded-xl py-0 lg:min-h-[calc(100vh-7rem)]">
                    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
                        {/* Left — Activity / Comments */}
                        <div className="flex flex-col">
                            <div className="flex-1 space-y-4 p-5">
                                <h3 className="text-sm font-semibold">Activity</h3>

                                {comments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No activity yet. Post a comment to get started.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {comments.map((comment) =>
                                            editingComment?.id === comment.id ? (
                                                <div key={comment.id} className="space-y-2">
                                                    <Textarea
                                                        value={editBody}
                                                        onChange={(e) => setEditBody(e.target.value)}
                                                        rows={3}
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button size="sm" onClick={handleEditSave}>
                                                            Save
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <CommentBubble
                                                    key={comment.id}
                                                    comment={comment}
                                                    currentUserId={currentUserId}
                                                    onEdit={handleEditStart}
                                                    onDelete={handleDelete}
                                                />
                                            ),
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto border-t p-3">
                                {attachments.length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        {attachments.map((file, i) => (
                                            <div key={i} className="bg-muted flex items-center gap-1.5 rounded px-2 py-1 text-xs">
                                                <FileText className="h-3 w-3" />
                                                <span className="max-w-[160px] truncate">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
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
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            setAttachments([...attachments, ...Array.from(e.target.files ?? [])]);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
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
                                                handlePost();
                                            }
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
                                        onClick={handlePost}
                                        disabled={submitting || (!commentBody.trim() && attachments.length === 0)}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right — Sidebar */}
                        <div className="bg-muted/40 max-lg:border-t lg:border-l space-y-4 p-5">
                            <div className="flex items-start justify-between gap-2">
                                <h2 className="text-lg font-semibold">{project.project_number}</h2>
                                <div className="flex flex-wrap items-center gap-1">
                                    <Badge variant="outline">{STATUS_LABELS[project.status]}</Badge>
                                    {project.company && <Badge variant="secondary">{project.company}</Badge>}
                                    {project.archived_at && (
                                        <Badge variant="outline" className="gap-1">
                                            <Archive className="h-3 w-3" /> Archived
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium">{project.name}</h3>
                                {project.description && (
                                    <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{project.description}</p>
                                )}
                            </div>

                            <Button asChild variant="outline" size="sm" className="w-full">
                                <Link href={`/forecast-projects/${project.id}/forecast`}>
                                    <ArrowRight className="mr-2 h-3 w-3" /> Go to Forecast
                                </Link>
                            </Button>

                            <Separator />

                            <dl className="space-y-3">
                                <SidebarField label="Revenue forecast" value={currency(project.total_revenue_forecast)} />
                                <SidebarField label="Cost budget" value={currency(project.total_cost_budget)} />
                                <SidebarField label="Start date" value={formatDate(project.start_date)} />
                                <SidebarField label="End date" value={formatDate(project.end_date)} />
                            </dl>

                            <Separator />

                            <dl className="space-y-3">
                                <SidebarField label="Created by" value={project.created_by_name} />
                                <SidebarField label="Created at" value={new Date(project.created_at).toLocaleString('en-AU')} />
                                <SidebarField label="Last updated by" value={project.updated_by_name} />
                                <SidebarField label="Last updated at" value={new Date(project.updated_at).toLocaleString('en-AU')} />
                                {project.archived_at && (
                                    <>
                                        <SidebarField label="Archived by" value={project.archived_by_name} />
                                        <SidebarField
                                            label="Archived at"
                                            value={new Date(project.archived_at).toLocaleString('en-AU')}
                                        />
                                    </>
                                )}
                            </dl>
                        </div>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}

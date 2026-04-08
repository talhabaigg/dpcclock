import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryFormOptions } from '@/types/injury';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Activity, Download, FileText, Lock, Paperclip, Pencil, Send, Trash2, Unlock } from 'lucide-react';
import { useRef, useState } from 'react';

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
    injury: Injury;
    comments: CommentData[];
    options: InjuryFormOptions;
}

function UserAvatar({ name }: { name: string }) {
    const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            {initials}
        </div>
    );
}

function SystemComment({ comment }: { comment: CommentData }) {
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
                </div>
                {comment.body && (
                    <p className="text-muted-foreground mt-0.5 text-xs whitespace-pre-wrap"
                       dangerouslySetInnerHTML={{ __html: comment.body.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>') }}
                    />
                )}
            </div>
        </div>
    );
}

function CommentBubble({ comment, currentUserId, onEdit, onDelete }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
}) {
    if (comment.metadata) {
        return <SystemComment comment={comment} />;
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
                {comment.attachments.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {comment.attachments.map((att) => (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
                                <FileText className="h-3 w-3" /> {att.file_name}
                            </a>
                        ))}
                    </div>
                )}
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

function SidebarField({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm">{value || '—'}</dd>
        </div>
    );
}

export default function InjuryShow({ injury, comments, options }: Props) {
    const auth = usePage().props.auth as { user?: { id: number }; permissions?: string[] };
    const currentUserId = auth?.user?.id;
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);
    const [commentBody, setCommentBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editBody, setEditBody] = useState('');
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

    const [classifyOpen, setClassifyOpen] = useState(false);
    const [classForm, setClassForm] = useState({ work_cover_claim: injury.work_cover_claim, work_days_missed: injury.work_days_missed, report_type: injury.report_type ?? '' });
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

    const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('en-AU') : '—');

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

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                <Card className="gap-0 overflow-hidden rounded-xl py-0 lg:min-h-[calc(100vh-7rem)]">
                    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
                        {/* Left Column — Activity / Comments */}
                        <div className="flex flex-col">
                            <div className="flex-1 space-y-4 p-5">
                                <h3 className="text-sm font-semibold">Activity</h3>

                                {comments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No activity yet. Post a comment to get started.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {comments.map((comment) => (
                                            <CommentBubble
                                                key={comment.id}
                                                comment={comment}
                                                currentUserId={currentUserId}
                                                onEdit={handleEditComment}
                                                onDelete={handleDeleteComment}
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
                                <SidebarField label="Name" value={injury.employee?.preferred_name ?? injury.employee?.name} />
                                <SidebarField label="Address" value={injury.employee_address} />
                            </div>

                            <Separator />

                            {/* Reporting */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reporting</h4>
                                    {can('injury-register.edit') && (
                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setClassForm({ work_cover_claim: injury.work_cover_claim, work_days_missed: injury.work_days_missed, report_type: injury.report_type ?? '' }); setClassifyOpen(true); }}>
                                            <Pencil className="mr-1 h-3 w-3" /> Edit
                                        </Button>
                                    )}
                                </div>
                                <SidebarField label="Reported By" value={injury.reported_by} />
                                <SidebarField label="Reported At" value={fmtDate(injury.reported_at)} />
                                <SidebarField label="Reported To" value={injury.reported_to} />
                                <SidebarField label="WorkCover Claim" value={injury.work_cover_claim ? 'Yes' : 'No'} />
                                <SidebarField label="Days Lost" value={injury.work_days_missed} />
                            </div>

                            <Separator />

                            {/* Treatment */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Treatment</h4>
                                <SidebarField label="Emergency Services" value={injury.emergency_services ? 'Yes' : 'No'} />
                                <SidebarField label="Treatment Provided" value={injury.treatment ? 'Yes' : 'No'} />
                                {injury.treatment && (
                                    <>
                                        <SidebarField label="Provider" value={injury.treatment_provider} />
                                        <SidebarField label="External" value={injury.treatment_external ? options.treatmentExternal[injury.treatment_external] : null} />
                                    </>
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
                                                    <a key={m.id} href={m.original_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
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
                                    <Download className="mr-1 h-4 w-4" /> Download PDF
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
                <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Work cover / days lost / report type</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                            <Switch
                                checked={classForm.work_cover_claim}
                                onCheckedChange={(v) => setClassForm({ ...classForm, work_cover_claim: v })}
                            />
                            <Label>Was a WorkCover claim submitted?</Label>
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Days Lost</Label>
                            <Input
                                type="number"
                                min={0}
                                value={classForm.work_days_missed}
                                onChange={(e) => setClassForm({ ...classForm, work_days_missed: parseInt(e.target.value) || 0 })}
                                className="w-32"
                            />
                        </div>
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

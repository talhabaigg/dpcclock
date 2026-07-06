import { SuccessAlertFlash } from '@/components/alert-flash';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type RequestPayload } from '@inertiajs/core';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Bell, Calendar, ClipboardCheck, FileText, Mail, MessageSquare, MoreVertical, Package, Paperclip, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { cardSubline, type DeliverableDetail, type DeliverableLocation, formatDate, statusBadgeClass, statusLabel, type TypesConfig } from './shared';

interface Attachment {
    id: number;
    file_name: string;
    url: string;
    mime_type: string | null;
    size: number;
}

interface Comment {
    id: number;
    body: string | null;
    user: { id: number; name: string } | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    attachments: Attachment[];
}

interface Props {
    location: DeliverableLocation;
    entry: DeliverableDetail;
    comments: Comment[];
    types: TypesConfig;
}

function initials(name: string): string {
    return name
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function WhsDeliverableShow({ location, entry, comments, types }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props;
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const baseUrl = `/locations/${location.id}/whs-deliverables`;
    const config = types[entry.type];
    const subline = cardSubline(entry);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [emailOpen, setEmailOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [posting, setPosting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'WHS Deliverables', href: '/whs-deliverables' },
        { title: location.name, href: baseUrl },
        { title: entry.name, href: `${baseUrl}/${entry.id}` },
    ];

    const detailRows = config.fields.map((f) => ({ label: f.label, value: entry.details?.[f.key] ?? '—' })).filter((r) => r.value && r.value !== '—');

    const postComment = () => {
        if (!draft.trim() && !attachment) return;
        const payload: RequestPayload = {
            commentable_type: 'whs_deliverable',
            commentable_id: entry.id,
            body: draft,
        };
        if (attachment) payload.attachments = [attachment];

        router.post('/comments', payload, {
            forceFormData: true,
            preserveScroll: true,
            onStart: () => setPosting(true),
            onSuccess: () => {
                setDraft('');
                setAttachment(null);
                if (fileRef.current) fileRef.current.value = '';
            },
            onFinish: () => setPosting(false),
        });
    };

    const toggleNotify = () => {
        router.patch(`${baseUrl}/${entry.id}/notify`, {}, { preserveScroll: true });
    };

    const confirmDelete = () => {
        router.delete(`${baseUrl}/${entry.id}`);
    };

    const nextLabelLower = config.next_label.toLowerCase();
    const emailWhen =
        entry.days_until === null
            ? 'soon'
            : entry.days_until < 0
              ? `${Math.abs(entry.days_until)} day(s) ago`
              : entry.days_until === 0
                ? 'today'
                : `in ${entry.days_until} day(s)`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${entry.name} — WHS Deliverables`} />
            <SuccessAlertFlash message={flash?.success} />

            <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground h-8 gap-1.5 px-2 text-xs" onClick={() => router.visit(baseUrl)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to register
                </Button>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                    {/* LEFT: activity */}
                    <div className="bg-card flex min-h-[28rem] flex-col rounded-xl border lg:h-[calc(100vh-12rem)]">
                        <div className="flex items-center gap-2 border-b px-5 py-3.5">
                            <MessageSquare className="text-muted-foreground h-4 w-4" />
                            <span className="text-sm font-semibold">Activity</span>
                        </div>

                        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                            {comments.length === 0 ? (
                                <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
                                    <MessageSquare className="h-6 w-6" />
                                    <div className="text-sm">No activity yet</div>
                                    <div className="text-muted-foreground/70 text-xs">Add a note or attach a service record below.</div>
                                </div>
                            ) : (
                                comments.map((c) => <ActivityItem key={c.id} comment={c} />)
                            )}
                        </div>

                        <div className="border-t px-4 py-3">
                            {attachment && (
                                <div className="bg-muted/40 mb-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                                    <Paperclip className="text-muted-foreground h-3.5 w-3.5" />
                                    <span className="max-w-[180px] truncate">{attachment.name}</span>
                                    <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-foreground">
                                        ✕
                                    </button>
                                </div>
                            )}
                            <div className="focus-within:border-foreground/30 flex items-center gap-2 rounded-xl border px-2 py-1.5">
                                <Input
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            postComment();
                                        }
                                    }}
                                    placeholder="Add a comment…"
                                    className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                                />
                                <label className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-md">
                                    <Paperclip className="h-4 w-4" />
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                                    />
                                </label>
                                <Button
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={postComment}
                                    disabled={posting || (!draft.trim() && !attachment)}
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: details */}
                    <div className="space-y-4">
                        {/* header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="truncate text-xl font-semibold tracking-tight">{entry.name}</h1>
                                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(entry.status_key)}`}>
                                        {statusLabel(entry.status_key, entry.days_until)}
                                    </span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span className="bg-muted text-foreground/80 rounded px-1.5 py-0.5 text-[11px] font-medium">
                                        {entry.type_label}
                                    </span>
                                    {subline && <span className="text-muted-foreground font-mono text-xs">{subline}</span>}
                                </div>
                            </div>
                            {(can('whs-deliverables.edit') || can('whs-deliverables.delete')) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                                        {can('whs-deliverables.edit') && (
                                            <DropdownMenuItem asChild>
                                                <Link href={`${baseUrl}/${entry.id}/edit`}>Edit deliverable</Link>
                                            </DropdownMenuItem>
                                        )}
                                        {can('whs-deliverables.delete') && (
                                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteOpen(true)}>
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>

                        {/* photo */}
                        {config.physical && entry.photo_url && (
                            <div className="overflow-hidden rounded-xl border">
                                <img src={entry.photo_url} alt={entry.name} className="h-48 w-full object-cover" />
                            </div>
                        )}

                        {/* detail card */}
                        <div className="bg-card divide-y rounded-xl border">
                            {detailRows.length > 0 && (
                                <div className="p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Package className="text-muted-foreground h-4 w-4" />
                                        <span className="text-sm font-semibold">{entry.type_label} details</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                        {detailRows.map((row) => (
                                            <div key={row.label}>
                                                <div className="text-muted-foreground text-[11px]">{row.label}</div>
                                                <div className="mt-0.5 text-sm font-medium">{row.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* service & expiry */}
                            <div className="p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <Calendar className="text-muted-foreground h-4 w-4" />
                                    <span className="text-sm font-semibold">Service &amp; expiry</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                    <div>
                                        <div className="text-muted-foreground text-[11px]">{config.last_label}</div>
                                        <div className="mt-0.5 font-mono text-sm font-medium">{formatDate(entry.last_date)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground text-[11px]">{config.next_label}</div>
                                        <div className="mt-0.5 font-mono text-sm font-medium">{formatDate(entry.next_date)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* checklist */}
                            {config.checklist && (
                                <div className="p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <ClipboardCheck className="text-muted-foreground h-4 w-4" />
                                        <span className="text-sm font-semibold">{config.checklist_label ?? 'Inspection checklist'}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {config.checklist.map((item) => {
                                            const checked = !!entry.checklist?.[item.key];
                                            const inputValue = item.input_key ? entry.details?.[item.input_key] : undefined;
                                            return (
                                                <div key={item.key} className="text-sm">
                                                    <div className="flex items-center gap-2.5">
                                                        <span
                                                            className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] ${
                                                                checked
                                                                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                                    : 'border-border text-transparent'
                                                            }`}
                                                        >
                                                            ✓
                                                        </span>
                                                        <span className={checked ? '' : 'text-muted-foreground'}>{item.label}</span>
                                                    </div>
                                                    {checked && inputValue && (
                                                        <div className="text-muted-foreground mt-1 ml-[26px] text-xs">{inputValue}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* notifications */}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Bell className="text-muted-foreground h-4 w-4" />
                                        <span className="text-sm font-semibold">Expiry notifications</span>
                                    </div>
                                    <Switch checked={entry.notify} onCheckedChange={toggleNotify} disabled={!can('whs-deliverables.edit')} />
                                </div>
                                <p className="text-muted-foreground mt-2 text-xs">Email alert sent 7 days before the {nextLabelLower}.</p>
                                {entry.notify && (
                                    <Button variant="outline" size="sm" className="mt-3 h-8 gap-1.5 text-xs" onClick={() => setEmailOpen(true)}>
                                        <Mail className="h-3.5 w-3.5" /> Preview alert email
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* delete */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this deliverable?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium">{entry.name}</span> will be removed from the {location.name} register. This can be restored
                            by an administrator.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* email preview */}
            <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-muted-foreground text-xs font-normal tracking-wide uppercase">Email preview</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                            <span className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">⚠</span>
                            <div className="text-xs">
                                <div className="text-muted-foreground">register@yourco.app</div>
                                <div className="text-muted-foreground/70">to you · just now</div>
                            </div>
                        </div>
                        <div className="text-base font-semibold">
                            {config.next_label} {emailWhen}: {entry.name}
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            The {config.next_label.toLowerCase()} for <span className="text-foreground font-medium">{entry.name}</span> (
                            {entry.type_label}) at {location.name} is {formatDate(entry.next_date)}
                            {entry.days_until !== null && entry.days_until < 0 ? ' and is now overdue' : ''}. Please arrange re-inspection and update
                            the register once complete.
                        </p>
                        <div className="bg-primary text-primary-foreground inline-block rounded-md px-3.5 py-2 text-xs font-semibold">
                            View deliverable →
                        </div>
                        <p className="text-muted-foreground/70 border-t pt-3 text-[11px]">
                            You receive this because notifications are enabled for this deliverable.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function ActivityItem({ comment }: { comment: Comment }) {
    const isSystem = comment.metadata && Object.keys(comment.metadata).length > 0;
    const author = comment.user?.name ?? 'System';

    if (isSystem) {
        return (
            <div className="flex items-center justify-center">
                <div className="bg-muted/60 text-muted-foreground rounded-full px-3 py-1 text-[11px]">
                    {comment.body} · {formatTime(comment.created_at)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-3">
            <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
                {initials(author)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{author}</span>
                    <span className="text-muted-foreground text-[11px]">{formatTime(comment.created_at)}</span>
                </div>
                {comment.body && <div className="text-foreground/90 mt-1 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</div>}
                {comment.attachments.map((a) => (
                    <Attachment key={a.id} attachment={a} />
                ))}
            </div>
        </div>
    );
}

function Attachment({ attachment }: { attachment: Attachment }) {
    const isImage = (attachment.mime_type ?? '').startsWith('image/');
    if (isImage) {
        return (
            <a href={attachment.url} target="_blank" rel="noopener" className="mt-2 block w-fit overflow-hidden rounded-lg border">
                <img src={attachment.url} alt={attachment.file_name} className="max-h-48 object-cover" />
            </a>
        );
    }
    const ext = attachment.file_name.split('.').pop()?.toUpperCase() ?? 'FILE';
    return (
        <a
            href={attachment.url}
            target="_blank"
            rel="noopener"
            className="bg-muted/30 hover:bg-muted mt-2 inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors"
        >
            <span className="bg-muted text-muted-foreground flex h-9 w-7 items-end justify-center rounded pb-1 text-[8px] font-bold">
                <FileText className="h-4 w-4" />
            </span>
            <span className="text-xs">
                <span className="block max-w-[180px] truncate font-medium">{attachment.file_name}</span>
                <span className="text-muted-foreground">{ext}</span>
            </span>
        </a>
    );
}

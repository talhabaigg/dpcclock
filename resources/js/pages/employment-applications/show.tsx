import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
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
    Check,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Clipboard,
    ExternalLink,
    FileIcon,
    History,
    ListChecks,
    Loader2,
    Mail,
    MapPin,
    Paperclip,
    Pencil,
    Phone,
    Plus,
    Send,
    Settings,
    Share2,
    Trash2,
    User,
    Wrench,
    XCircle,
    XIcon,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

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

interface PageProps {
    application: Application;
    comments: CommentData[];
    checklists: ChecklistData[];
    availableTemplates: TemplateOption[];
    duplicates: Duplicate[];
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

const PIPELINE_STATUSES = ['new', 'reviewing', 'phone_interview', 'reference_check', 'face_to_face', 'approved', 'contract_sent', 'contract_signed', 'onboarded'];

function StatusBadge({ status, className }: { status: string; className?: string }) {
    return (
        <Badge variant="secondary" className={cn('text-xs', className)}>
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

function getInitials(name: string): string {
    return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
    return (
        <Avatar className={cn('h-8 w-8', className)}>
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

function CommentBubble({ comment, currentUserId, onEdit, onDelete }: {
    comment: CommentData;
    currentUserId?: number;
    onEdit?: (comment: CommentData) => void;
    onDelete?: (commentId: number) => void;
}) {
    const isSystem = comment.metadata !== null;
    const statusChange = comment.metadata?.status_change as { from: string; to: string } | undefined;
    const isOwner = currentUserId !== undefined && comment.user?.id === currentUserId;

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
            {comment.user ? (
                <UserAvatar name={comment.user.name} />
            ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
            )}
            <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-2">
                    <p className="text-sm">
                        <span className="font-medium">{comment.user?.name ?? 'System'}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{formatDateTime(comment.created_at)}</span>
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
                                    className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                                    onClick={() => onEdit?.(comment)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 gap-1.5"
                                    onClick={() => onDelete?.(comment.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </Button>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
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
                            <CommentBubble key={reply.id} comment={reply} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                    </div>
                )}
            </div>
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
        router.delete(route('checklists.destroy', checklistId), {
            preserveScroll: true,
        });
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
        <Card className="rounded-xl">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">Checklists</CardTitle>
                        {totalItems > 0 && (
                            <span className="text-muted-foreground text-xs">
                                {completedItems}/{totalItems}
                                {requiredIncomplete > 0 && (
                                    <span className="ml-1 text-amber-600">({requiredIncomplete} required remaining)</span>
                                )}
                            </span>
                        )}
                    </div>
                    {canScreen && (
                        <div className="flex items-center gap-2 text-xs">
                            {availableTemplates.length > 0 && (
                                <Select onValueChange={handleAttachTemplate}>
                                    <SelectTrigger className="h-7 w-auto gap-1 border-0 px-2 text-xs shadow-none">
                                        <Plus className="h-3 w-3" />
                                        <SelectValue placeholder="Add checklist" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTemplates.map((t) => (
                                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <button
                                type="button"
                                className="text-primary flex items-center gap-1 hover:underline"
                                onClick={() => setShowAddChecklist(true)}
                            >
                                <ListChecks className="h-3 w-3" />
                                Custom
                            </button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {checklists.length === 0 && !showAddChecklist && (
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
            </CardContent>

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
        </Card>
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

export default function EmploymentApplicationShow({ application: app, comments, checklists, availableTemplates, duplicates }: PageProps) {
    const pageProps = usePage<{ auth: { permissions?: string[]; isAdmin?: boolean }; errors: Record<string, string> }>().props;
    const { auth, errors: pageErrors } = pageProps;
    const permissions = auth.permissions ?? [];
    const canScreen = auth.isAdmin || permissions.includes('employment-applications.screen');

    const [showDeclineDialog, setShowDeclineDialog] = useState(false);
    const [commentBody, setCommentBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(undefined);

    // Comment edit/delete state
    const [editingComment, setEditingComment] = useState<CommentData | null>(null);
    const [editBody, setEditBody] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

    // Comment filter & sort
    const [commentFilter, setCommentFilter] = useState<'all' | 'messages' | 'attachments' | 'history'>('all');
    const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');

    const currentUserId = (usePage().props.auth as { user?: { id: number } })?.user?.id;

    const declineForm = useForm({ reason: '' });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Applications', href: '/employment-applications' },
        { title: `${app.first_name} ${app.surname}`, href: `/employment-applications/${app.id}` },
    ];

    const occupationDisplay = app.occupation === 'other' && app.occupation_other ? app.occupation_other : app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);

    function handleStatusChange(newStatus: string) {
        if (newStatus === app.status) return;
        if (newStatus === 'declined') {
            setShowDeclineDialog(true);
            return;
        }
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

    function handleEditComment(comment: CommentData) {
        setEditingComment(comment);
        setEditBody(comment.body);
    }

    function handleSaveEdit() {
        if (!editingComment || !editBody.trim()) return;
        setEditSaving(true);
        router.patch(route('comments.update', editingComment.id), { body: editBody }, {
            preserveScroll: true,
            onSuccess: () => setEditingComment(null),
            onFinish: () => setEditSaving(false),
        });
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

    // Compute filtered & sorted comments
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
                        <ChecklistSection
                            checklists={checklists}
                            availableTemplates={availableTemplates}
                            applicationId={app.id}
                            canScreen={canScreen}
                        />

                        {/* Activity / Comments Feed */}
                        <Card className="flex min-h-[400px] flex-col rounded-xl">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold">Activity</CardTitle>
                                </div>
                                {/* Filter & Sort bar */}
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
                            </CardHeader>

                            <CardContent className="flex-1 space-y-4">
                                {comments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No activity yet. Post a comment to get started.
                                    </p>
                                ) : filteredComments.length === 0 ? (
                                    <p className="text-muted-foreground py-8 text-center text-sm italic">
                                        No {commentFilter === 'attachments' ? 'attachments' : commentFilter === 'history' ? 'history' : 'messages'} found.
                                    </p>
                                ) : (
                                    filteredComments.map((comment) => (
                                        <CommentBubble
                                            key={comment.id}
                                            comment={comment}
                                            currentUserId={currentUserId}
                                            onEdit={handleEditComment}
                                            onDelete={handleDeleteComment}
                                        />
                                    ))
                                )}
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
                                            onFocus={() => setInputFocused(true)}
                                            onBlur={() => setInputFocused(false)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                    e.preventDefault();
                                                    handlePostComment();
                                                }
                                            }}
                                        />
                                        {inputFocused || commentBody.trim() || attachments.length > 0 ? (
                                            <Button
                                                size="icon"
                                                className="h-10 w-10 shrink-0"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={handlePostComment}
                                                disabled={submitting || (!commentBody.trim() && attachments.length === 0)}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5">
                                                        <Share2 className="h-3.5 w-3.5" />
                                                        Share
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
                                        )}
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
                                        <Select value={app.status} onValueChange={handleStatusChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Change status..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[...PIPELINE_STATUSES, 'declined'].map((s) => (
                                                    <SelectItem key={s} value={s}>
                                                        {STATUS_LABELS[s]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {pageErrors.status && (
                                            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{pageErrors.status}</p>
                                        )}
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

            {/* Edit Comment Dialog */}
            <Dialog open={editingComment !== null} onOpenChange={(open) => { if (!open) setEditingComment(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Comment</DialogTitle>
                        <DialogDescription>Update your comment below.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        className="resize-none"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={editSaving || !editBody.trim()}>
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

        </AppLayout>
    );
}

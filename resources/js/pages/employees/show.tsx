import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import EmployeeFilesCard from '@/components/employee-files/employee-files-card';
import { AlertTriangle, BookOpen, Check, Clock, FileIcon, FolderOpen, LinkIcon, Loader2, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Worktype {
    id: number;
    eh_worktype_id: string;
    name: string;
}

interface ClockEntry {
    id: number;
    clock_in: string;
}

interface IncidentReport {
    id: number;
    report_number: string;
    incident_date: string;
    incident_type: string | null;
    project_name: string | null;
    status: string;
    location?: { external_id: string; name: string } | null;
}

interface Project {
    id: number;
    name: string;
    external_id: string;
    kiosk_id: number;
}

interface JournalAttachment {
    id: number;
    name: string;
    url: string;
    mime_type: string;
    size: number;
}

interface JournalEntry {
    id: number;
    body: string;
    type: 'positive' | 'negative' | null;
    user: { id: number; name: string } | null;
    created_at: string;
    attachments: JournalAttachment[];
}

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    email: string;
    pin: string;
    external_id?: string;
    eh_employee_id?: string;
    employment_type?: string;
    display_name: string;
    worktypes?: Worktype[];
    clocks?: ClockEntry[];
    incident_reports?: IncidentReport[];
    created_at: string;
    updated_at: string;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="py-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <div className="mt-1 text-sm">{children || <span className="text-muted-foreground italic">—</span>}</div>
        </div>
    );
}

export default function EmployeeShow() {
    const { employee: emp, projects, weekEnding, journal, auth } = usePage<{
        employee: Employee;
        projects: Project[];
        weekEnding: string;
        journal: JournalEntry[];
        auth: { user?: { id: number; name: string } };
    }>().props;

    const currentUserId = auth?.user?.id;

    // Journal form state
    const [journalBody, setJournalBody] = useState('');
    const [journalType, setJournalType] = useState<string>('positive');
    const [journalFiles, setJournalFiles] = useState<File[]>([]);
    const [journalSubmitting, setJournalSubmitting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const submitJournal = useCallback(() => {
        if (!journalBody.trim() && journalFiles.length === 0) return;
        setJournalSubmitting(true);

        const formData = new FormData();
        formData.append('commentable_type', 'employee');
        formData.append('commentable_id', String(emp.id));
        formData.append('body', journalBody.trim());
        formData.append('type', journalType);
        journalFiles.forEach((file) => formData.append('attachments[]', file));

        router.post('/comments', formData as any, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setJournalBody('');
                setJournalType('positive');
                setJournalFiles([]);
            },
            onFinish: () => setJournalSubmitting(false),
        });
    }, [journalBody, journalType, journalFiles, emp.id]);

    const deleteJournal = useCallback((id: number) => {
        router.delete(`/comments/${id}`, {
            preserveScroll: true,
            onSuccess: () => setConfirmDeleteId(null),
        });
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employees', href: '/employees' },
        { title: emp.display_name || emp.name, href: `/employees/${emp.id}` },
    ];

    const employmentTypeLabel = emp.employment_type?.replace(/([A-Z])/g, ' $1').trim();

    // Derive unique week-ending dates (Fridays) from recent clocks, excluding current week
    const recentWeekEndings = useMemo(() => {
        if (!emp.clocks || emp.clocks.length === 0) return [];
        const seen = new Set<string>();
        seen.add(weekEnding); // exclude current week
        return emp.clocks
            .map((clock) => {
                const d = new Date(clock.clock_in);
                const day = d.getDay();
                const diff = (5 - day + 7) % 7;
                const friday = new Date(d);
                friday.setDate(d.getDate() + diff);
                const dd = String(friday.getDate()).padStart(2, '0');
                const mm = String(friday.getMonth() + 1).padStart(2, '0');
                const yyyy = friday.getFullYear();
                return `${dd}-${mm}-${yyyy}`;
            })
            .filter((we) => {
                if (seen.has(we)) return false;
                seen.add(we);
                return true;
            });
    }, [emp.clocks, weekEnding]);

    // Location management state
    const [locationDialogOpen, setLocationDialogOpen] = useState(false);
    const [selectedLocationNames, setSelectedLocationNames] = useState<Set<string>>(new Set());
    const [ehLocations, setEhLocations] = useState<{ id: number; name: string; externalId: string | null }[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [savingLocations, setSavingLocations] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationSuccess, setLocationSuccess] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLocations = useMemo(() => {
        if (!searchQuery) return ehLocations;
        const q = searchQuery.toLowerCase();
        return ehLocations.filter(
            (loc) => loc.name.toLowerCase().includes(q) || loc.externalId?.toLowerCase().includes(q),
        );
    }, [ehLocations, searchQuery]);

    const openLocationDialog = useCallback(async () => {
        setLocationDialogOpen(true);
        setLoadingLocations(true);
        setLocationError(null);
        setLocationSuccess(null);
        setSearchQuery('');

        try {
            const response = await fetch(`/employees/${emp.id}/locations`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) throw new Error('Failed to fetch current locations');

            const data = await response.json();

            // Set available EH locations
            setEhLocations(data.allEhLocations || []);

            // Parse pipe-separated location names (these are the exact EH names)
            const locationString: string = data.locations || '';
            const names = locationString
                .split('|')
                .map((n: string) => n.trim())
                .filter(Boolean);
            setSelectedLocationNames(new Set(names));
        } catch (err: any) {
            setLocationError(err.message || 'Failed to load current locations');
        } finally {
            setLoadingLocations(false);
        }
    }, [emp.id]);

    const toggleLocation = useCallback((locationName: string) => {
        setSelectedLocationNames((prev) => {
            const next = new Set(prev);
            if (next.has(locationName)) {
                next.delete(locationName);
            } else {
                next.add(locationName);
            }
            return next;
        });
    }, []);

    const saveLocations = useCallback(async () => {
        setSavingLocations(true);
        setLocationError(null);
        setLocationSuccess(null);

        try {
            const locationsString = Array.from(selectedLocationNames).join('|');

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch(`/employees/${emp.id}/locations`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ locations: locationsString }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to update locations');
            }

            setLocationSuccess('Locations updated successfully');
            setTimeout(() => {
                setLocationDialogOpen(false);
                router.reload();
            }, 1500);
        } catch (err: any) {
            setLocationError(err.message || 'Failed to update locations');
        } finally {
            setSavingLocations(false);
        }
    }, [emp.id, selectedLocationNames]);

    // Clear success message on dialog close
    useEffect(() => {
        if (!locationDialogOpen) {
            setLocationSuccess(null);
            setLocationError(null);
        }
    }, [locationDialogOpen]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={emp.display_name || emp.name} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Two-column layout */}
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-4">
                        {/* About Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                                            {getInitials(emp.name || '??')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <CardTitle className="text-base">About</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-0 pt-0">
                                <Separator />
                                <DetailItem label="Employee Type">
                                    {employmentTypeLabel ? (
                                        <Badge variant={emp.employment_type === 'FullTime' ? 'default' : emp.employment_type === 'Casual' ? 'outline' : 'secondary'} className="text-xs">
                                            {employmentTypeLabel}
                                        </Badge>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Email Address">
                                    {emp.email ? (
                                        <a href={`mailto:${emp.email}`} className="text-primary hover:underline">
                                            {emp.email}
                                        </a>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="External ID">
                                    {emp.external_id?.trim() ? (
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{emp.external_id}</code>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="EH Employee ID">
                                    {emp.eh_employee_id?.trim() ? (
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{emp.eh_employee_id}</code>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Work Types">
                                    {emp.worktypes && emp.worktypes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {emp.worktypes.map((wt) => (
                                                <Badge key={wt.id} variant="secondary" className="text-xs">
                                                    {wt.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : null}
                                </DetailItem>
                            </CardContent>
                        </Card>

                        {/* Timesheets Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Clock className="h-4 w-4" />
                                    Timesheets
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 pt-0">
                                <Separator className="mb-2" />
                                <Link
                                    href={`/timesheets?employeeId=${emp.eh_employee_id}&weekEnding=${weekEnding}`}
                                    className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                                >
                                    <LinkIcon className="h-3.5 w-3.5" />
                                    This weeks timesheet
                                </Link>
                                {recentWeekEndings.length > 0 &&
                                    recentWeekEndings.map((we) => (
                                        <Link
                                            key={we}
                                            href={`/timesheets?employeeId=${emp.eh_employee_id}&weekEnding=${we}`}
                                            className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                                        >
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            {we}
                                        </Link>
                                    ))}
                            </CardContent>
                        </Card>

                        {/* Journal Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <BookOpen className="h-4 w-4" />
                                    Journal
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4 pt-0">
                                <Separator />
                                {/* New entry form */}
                                <div className="flex flex-col gap-2">
                                    <AiRichTextEditor
                                        content={journalBody}
                                        onChange={setJournalBody}
                                        placeholder="Add a journal entry..."
                                        enableAttachments
                                        attachments={journalFiles}
                                        onAttachmentsChange={setJournalFiles}
                                    />
                                    <div className="flex items-center gap-2">
                                        <div className="ml-auto flex items-center gap-0">
                                            <div className="inline-flex rounded-md border" role="group">
                                                <button
                                                    type="button"
                                                    onClick={() => setJournalType('positive')}
                                                    className={`inline-flex h-8 items-center gap-1.5 rounded-l-md px-3 text-xs font-medium transition-colors ${
                                                        journalType === 'positive'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                                            : 'bg-background text-muted-foreground hover:bg-accent'
                                                    }`}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5" />
                                                    Positive
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setJournalType('negative')}
                                                    className={`inline-flex h-8 items-center gap-1.5 rounded-r-md border-l px-3 text-xs font-medium transition-colors ${
                                                        journalType === 'negative'
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                                            : 'bg-background text-muted-foreground hover:bg-accent'
                                                    }`}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                    Negative
                                                </button>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-8 ml-2"
                                                onClick={submitJournal}
                                                disabled={journalSubmitting || (!journalBody.trim() && journalFiles.length === 0)}
                                            >
                                                {journalSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                                Add Entry
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Journal entries */}
                                {journal && journal.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {journal.map((entry) => (
                                            <div key={entry.id} className={`rounded-lg border p-3 ${
                                                entry.type === 'positive'
                                                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                                                    : entry.type === 'negative'
                                                    ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                                                    : ''
                                            }`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        {entry.type === 'positive' ? (
                                                            <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                                        ) : entry.type === 'negative' ? (
                                                            <ThumbsDown className="h-3.5 w-3.5 shrink-0 text-red-600" />
                                                        ) : null}
                                                        <span className="text-xs font-medium">{entry.user?.name ?? 'System'}</span>
                                                        <span className="text-muted-foreground text-xs">{formatDate(entry.created_at)}</span>
                                                    </div>
                                                    {currentUserId === entry.user?.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmDeleteId(entry.id)}
                                                            className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                {entry.body && <div className="prose prose-sm max-w-none dark:prose-invert mt-1.5" dangerouslySetInnerHTML={{ __html: entry.body }} />}
                                                {entry.attachments && entry.attachments.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {entry.attachments.map((att) =>
                                                            att.mime_type.startsWith('image/') ? (
                                                                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                                                    <img src={att.url} alt={att.name} className="max-h-36 rounded-lg border object-cover" />
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
                                                                </a>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No journal entries yet</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-4">
                        {/* Licences, tickets & training */}
                        <EmployeeFilesCard employeeId={emp.id} />

                        {/* Projects Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <FolderOpen className="h-4 w-4" />
                                        Projects
                                    </CardTitle>
                                    <Button variant="outline" size="sm" className="gap-1.5" onClick={openLocationDialog}>
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit Locations
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-4" />
                                {projects && projects.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {projects.map((project) => (
                                            <Link key={project.id} href={`/kiosks/${project.kiosk_id}/edit`}>
                                                <Badge variant="outline" className="text-sm hover:bg-accent cursor-pointer">
                                                    {project.external_id || project.name}
                                                </Badge>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No projects assigned</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Injury Register Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <AlertTriangle className="h-4 w-4" />
                                    Injury Register
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-4" />
                                {emp.incident_reports && emp.incident_reports.length > 0 ? (
                                    <div className="overflow-hidden rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="px-3 text-xs">ID</TableHead>
                                                    <TableHead className="px-3 text-xs">Occurred at</TableHead>
                                                    <TableHead className="px-3 text-xs">Project</TableHead>
                                                    <TableHead className="px-3 text-xs">Incident</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {emp.incident_reports.map((report) => (
                                                    <TableRow key={report.id}>
                                                        <TableCell className="px-3 text-xs font-medium">{report.report_number}</TableCell>
                                                        <TableCell className="px-3 text-xs">{formatDate(report.incident_date)}</TableCell>
                                                        <TableCell className="px-3 text-xs">
                                                            {report.project_name || report.location?.external_id || '—'}
                                                        </TableCell>
                                                        <TableCell className="px-3">
                                                            {report.incident_type ? (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {report.incident_type}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No injury register records found</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Delete Journal Entry Confirmation */}
            <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Journal Entry</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this journal entry? This cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => confirmDeleteId && deleteJournal(confirmDeleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Locations Dialog */}
            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogContent className="max-h-[80vh] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Location Access</DialogTitle>
                        <DialogDescription>
                            Select which locations {emp.display_name} should have access to.
                        </DialogDescription>
                    </DialogHeader>

                    {locationError && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
                            {locationError}
                        </div>
                    )}

                    {locationSuccess && (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                            <Check className="h-4 w-4" />
                            {locationSuccess}
                        </div>
                    )}

                    {loadingLocations ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                            <span className="text-muted-foreground ml-2 text-sm">Loading current locations...</span>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search locations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto">
                                <div className="flex flex-col gap-1">
                                    {filteredLocations.map((loc) => (
                                        <label
                                            key={loc.id}
                                            className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors"
                                        >
                                            <Checkbox
                                                checked={selectedLocationNames.has(loc.name)}
                                                onCheckedChange={() => toggleLocation(loc.name)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{loc.name}</p>
                                                {loc.externalId && (
                                                    <p className="text-muted-foreground text-xs truncate">{loc.externalId}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                    {filteredLocations.length === 0 && (
                                        <p className="text-muted-foreground py-4 text-center text-sm">No locations found</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <DialogFooter>
                        <div className="flex items-center justify-between w-full">
                            <span className="text-muted-foreground text-xs">
                                {selectedLocationNames.size} location{selectedLocationNames.size !== 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setLocationDialogOpen(false)} disabled={savingLocations}>
                                    Cancel
                                </Button>
                                <Button onClick={saveLocations} disabled={savingLocations || loadingLocations}>
                                    {savingLocations && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

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
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Download, GraduationCap, Lock, MessageSquare, Pencil, Trash2, Unlock } from 'lucide-react';
import { useMemo, useState } from 'react';

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

interface Props {
    prestart: Prestart;
    unsignedEmployees: UnsignedEmployee[];
    trainings: TrainingItem[];
    reasonOptions: Record<string, string>;
}

const DAILY_CHECKLIST = [
    "Today's trade specific works discussed and understood",
    'All SWMS reviewed and understood',
    'Work permits in place as required and conditions understood',
    'Tools and equipment in working order with Test & Tag up to date',
    'Required PPE available and fit for purpose',
    'Current Licences & Qualifications are relevant to work tasks',
];

export default function DailyPrestartShow({ prestart, unsignedEmployees, trainings, reasonOptions }: Props) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as { auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

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
                <WeatherWidget weather={prestart.weather as any} />

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
                                                                    <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                                                                        Present - Not Signed
                                                                    </Badge>
                                                                ) : emp.absence_reason ? (
                                                                    <Badge variant="outline" className="bg-blue-50 text-blue-900 border-blue-200">
                                                                        {emp.absence_reason}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-gray-50 text-gray-900 border-gray-200">
                                                                        No Record
                                                                    </Badge>
                                                                )}
                                                                {emp.clock_in_time && (
                                                                    <span className="text-xs text-slate-500">at {emp.clock_in_time}</span>
                                                                )}
                                                                {emp.reason_label && (
                                                                    <Badge variant="outline" className="bg-violet-50 text-violet-900 border-violet-200">
                                                                        {emp.reason_label}
                                                                    </Badge>
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

                {/* Signatures */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold">Signatures ({prestart.signatures.length})</h2>
                    {prestart.signatures.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No signatures yet.</p>
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
                    )}
                </div>
            </div>

        </AppLayout>
    );
}

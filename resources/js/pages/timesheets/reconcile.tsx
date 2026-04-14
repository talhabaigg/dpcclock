import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchSelect } from '@/components/search-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DatePickerDemo } from './components/datePicker';
import { parseWeekEndingDate } from './helper/dateParser';

type LocationOption = { id: number; label: string; value: string };

type LocalRow = {
    id: number;
    eh_timesheet_id: string | null;
    uuid: string | null;
    eh_employee_id: string | null;
    employee_name: string | null;
    employee_archived: boolean;
    eh_location_id: string | null;
    location_name: string | null;
    eh_worktype_id: number | null;
    worktype_name: string | null;
    clock_in: string | null;
    clock_out: string | null;
    hours_worked: number;
    status: string | null;
    incomplete: boolean;
    week_ending?: string;
};

type EhRow = {
    eh_id: number | null;
    employee_id: number | null;
    location_id: number | null;
    worktype_id: number | null;
    start_time: string | null;
    end_time: string | null;
    status: string | null;
    external_id: string | null;
    week_ending?: string;
};

type Mismatch = {
    clock: LocalRow;
    eh: EhRow;
    diff: Record<string, { local: unknown; eh: unknown }>;
    week_ending?: string;
};

type PerWeek = {
    week_ending: string;
    counts: Report['counts'];
};

interface Report {
    week_ending?: string;
    latest_week_ending?: string;
    weeks?: number;
    from?: string;
    to?: string;
    counts: {
        eh: number;
        local: number;
        matched: number;
        mismatched: number;
        unsynced: number;
        orphaned: number;
        eh_only: number;
        archived_employee_clocks: number;
    };
    per_week?: PerWeek[];
    eh_only: EhRow[];
    unsynced: LocalRow[];
    orphaned: LocalRow[];
    mismatched: Mismatch[];
    archived_clocks: LocalRow[];
}

interface Props {
    weekEnding: string;
    selectedLocation: string | null;
    selectedStatus: string | null;
    selectedWeeks: number;
    statusOptions: string[];
    weekOptions: number[];
    locations: LocationOption[];
    report: Report;
    flash?: { success?: string; error?: string };
}

function formatDMY(d: Date | null) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function fmtVal(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
}

const Reconcile = ({ weekEnding, selectedLocation, selectedStatus, selectedWeeks, statusOptions, weekOptions, locations, report }: Props) => {
    const flash = (usePage().props as { flash?: { success?: string; error?: string } }).flash;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Timesheets', href: '/timesheets' },
        {
            title: selectedWeeks > 1
                ? `EH Reconciliation — ${selectedWeeks} weeks ending ${weekEnding}`
                : `EH Reconciliation — Week Ending ${weekEnding}`,
            href: '/timesheets-reconcile',
        },
    ];
    const [weekEndingDate, setWeekEndingDate] = useState<Date | null>(parseWeekEndingDate(weekEnding));
    const [locationValue, setLocationValue] = useState<string | null>(selectedLocation ?? null);
    const [statusValue, setStatusValue] = useState<string>(selectedStatus ?? '');
    const [weeksValue, setWeeksValue] = useState<number>(selectedWeeks ?? 1);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        const nextWeek = formatDMY(weekEndingDate) || weekEnding;
        const nextLoc = locationValue ?? '';
        const nextStatus = statusValue ?? '';
        const nextWeeks = weeksValue;

        const currWeek = weekEnding;
        const currLoc = selectedLocation ?? '';
        const currStatus = selectedStatus ?? '';
        const currWeeks = selectedWeeks;

        if (nextWeek === currWeek && String(nextLoc) === String(currLoc) && nextStatus === currStatus && nextWeeks === currWeeks) {
            return;
        }

        setLoading(true);
        router.get(
            '/timesheets-reconcile',
            { weekEnding: nextWeek, location: nextLoc, status: nextStatus, weeks: nextWeeks },
            {
                replace: true,
                preserveScroll: true,
                onFinish: () => setLoading(false),
            },
        );
    }, [weekEndingDate, locationValue, statusValue, weeksValue, weekEnding, selectedLocation, selectedStatus, selectedWeeks]);

    const c = report.counts;
    const totalGaps = c.mismatched + c.unsynced + c.orphaned + c.eh_only;
    const multiWeek = (selectedWeeks ?? 1) > 1;

    const stateParams = {
        weekEnding,
        weeks: selectedWeeks,
        location: selectedLocation ?? '',
        status: selectedStatus ?? '',
    };

    const deleteIds = (ids: number[], label: string) => {
        if (!ids.length) return;
        setBusy(label);
        router.post(
            '/timesheets-reconcile/delete',
            { ...stateParams, ids },
            {
                preserveScroll: true,
                onFinish: () => setBusy(null),
            },
        );
    };

    const repullWeek = () => {
        setBusy('repull');
        router.post(
            '/timesheets-reconcile/repull',
            stateParams,
            {
                preserveScroll: true,
                onFinish: () => setBusy(null),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="EH Reconciliation" />
            <div className="space-y-4 p-4 md:p-6">
                {flash?.success && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
                        {flash.error}
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Employment Hero Reconciliation</CardTitle>
                        <CardDescription>
                            Compare local clocks against Employment Hero timesheets for the selected week. Employment Hero is the source
                            of truth for paid timesheets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                        <DatePickerDemo
                            initialDate={weekEndingDate ?? new Date()}
                            onDateChange={(d) => setWeekEndingDate(d)}
                        />
                        <div className="min-w-[220px]">
                            <SearchSelect
                                options={locations.map((l) => ({ label: l.label, value: l.value }))}
                                optionName="location"
                                selectedOption={locationValue ?? ''}
                                onValueChange={(v) => setLocationValue(v || null)}
                            />
                        </div>
                        <Select value={statusValue || 'all'} onValueChange={(v) => setStatusValue(v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                {statusOptions.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(weeksValue)} onValueChange={(v) => setWeeksValue(Number(v))}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {weekOptions.map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                        {n === 1 ? '1 week' : `Last ${n} weeks`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {loading && <span className="text-sm text-muted-foreground">Loading…</span>}

                        <div className="ml-auto">
                            <ConfirmButton
                                title={multiWeek ? `Pull all ${selectedWeeks} weeks from EH?` : 'Pull this week from EH?'}
                                description={
                                    multiWeek
                                        ? `Re-runs the EH pull for each of the ${selectedWeeks} weeks. Synchronous — expect roughly ${selectedWeeks * 2}–${selectedWeeks * 4}s.`
                                        : 'Re-runs the EH pull for this week. Local mismatches will be overwritten with EH values; missing local rows will be created.'
                                }
                                actionLabel="Pull from EH"
                                onConfirm={repullWeek}
                                trigger={
                                    <Button variant="default" disabled={busy === 'repull'}>
                                        {busy === 'repull' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                        {multiWeek ? `Pull ${selectedWeeks} weeks from EH` : 'Pull this week from EH'}
                                    </Button>
                                }
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                    <StatCard label="EH timesheets" value={c.eh} />
                    <StatCard label="Local clocks" value={c.local} />
                    <StatCard label="Matched" value={c.matched} tone="ok" />
                    <StatCard label="Mismatched" value={c.mismatched} tone={c.mismatched ? 'warn' : undefined} />
                    <StatCard label="Local-only (unsynced)" value={c.unsynced} tone={c.unsynced ? 'warn' : undefined} />
                    <StatCard label="Ghost (deleted in EH)" value={c.orphaned} tone={c.orphaned ? 'danger' : undefined} />
                    <StatCard label="EH-only (missing locally)" value={c.eh_only} tone={c.eh_only ? 'danger' : undefined} />
                </div>

                {multiWeek && report.per_week && report.per_week.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Per-week breakdown</CardTitle>
                            <CardDescription>Click a week to drill in.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Week ending</TableHead>
                                            <TableHead className="text-right">EH</TableHead>
                                            <TableHead className="text-right">Local</TableHead>
                                            <TableHead className="text-right">Matched</TableHead>
                                            <TableHead className="text-right">Mismatched</TableHead>
                                            <TableHead className="text-right">Unsynced</TableHead>
                                            <TableHead className="text-right">Ghosts</TableHead>
                                            <TableHead className="text-right">EH-only</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.per_week.map((w) => {
                                            const gaps = w.counts.mismatched + w.counts.unsynced + w.counts.orphaned + w.counts.eh_only;
                                            return (
                                                <TableRow
                                                    key={w.week_ending}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => {
                                                        setWeekEndingDate(parseWeekEndingDate(w.week_ending));
                                                        setWeeksValue(1);
                                                    }}
                                                >
                                                    <TableCell className="font-medium">
                                                        {w.week_ending}
                                                        {gaps === 0 && (
                                                            <Badge variant="outline" className="ml-2 text-emerald-600 border-emerald-300">clean</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">{w.counts.eh}</TableCell>
                                                    <TableCell className="text-right">{w.counts.local}</TableCell>
                                                    <TableCell className="text-right">{w.counts.matched}</TableCell>
                                                    <TableCell className={`text-right ${w.counts.mismatched ? 'text-amber-600 font-medium' : ''}`}>{w.counts.mismatched}</TableCell>
                                                    <TableCell className={`text-right ${w.counts.unsynced ? 'text-amber-600 font-medium' : ''}`}>{w.counts.unsynced}</TableCell>
                                                    <TableCell className={`text-right ${w.counts.orphaned ? 'text-rose-600 font-medium' : ''}`}>{w.counts.orphaned}</TableCell>
                                                    <TableCell className={`text-right ${w.counts.eh_only ? 'text-rose-600 font-medium' : ''}`}>{w.counts.eh_only}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Gaps ({totalGaps})</CardTitle>
                        <CardDescription>
                            Mismatched / EH-only are fixed by re-pulling. Unsynced and Ghosts are local-only stragglers — soft-delete them
                            (EH is truth; if EH had the shift, the pull would have created it).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="mismatched">
                            <TabsList>
                                <TabsTrigger value="mismatched">Mismatched ({c.mismatched})</TabsTrigger>
                                <TabsTrigger value="unsynced">Unsynced ({c.unsynced})</TabsTrigger>
                                <TabsTrigger value="orphaned">Ghosts ({c.orphaned})</TabsTrigger>
                                <TabsTrigger value="eh_only">EH-only ({c.eh_only})</TabsTrigger>
                            </TabsList>

                            <TabsContent value="mismatched" className="mt-4">
                                <MismatchedTable rows={report.mismatched} showWeek={multiWeek} />
                            </TabsContent>
                            <TabsContent value="unsynced" className="mt-4">
                                <DeletableLocalTable
                                    rows={report.unsynced}
                                    emptyText="Nothing unsynced."
                                    busy={busy}
                                    busyKey="unsynced"
                                    onDelete={(ids) => deleteIds(ids, 'unsynced')}
                                    showWeek={multiWeek}
                                />
                            </TabsContent>
                            <TabsContent value="orphaned" className="mt-4">
                                <DeletableLocalTable
                                    rows={report.orphaned}
                                    emptyText="No ghost records."
                                    showEhId
                                    busy={busy}
                                    busyKey="orphaned"
                                    onDelete={(ids) => deleteIds(ids, 'orphaned')}
                                    showWeek={multiWeek}
                                />
                            </TabsContent>
                            <TabsContent value="eh_only" className="mt-4">
                                <EhOnlyTable rows={report.eh_only} showWeek={multiWeek} />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
};

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'danger' }) {
    const toneClass =
        tone === 'ok'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tone === 'warn'
              ? 'text-amber-600 dark:text-amber-400'
              : tone === 'danger'
                ? 'text-rose-600 dark:text-rose-400'
                : '';
    return (
        <Card>
            <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
            </CardContent>
        </Card>
    );
}

function MismatchedTable({ rows, showWeek = false }: { rows: Mismatch[]; showWeek?: boolean }) {
    if (!rows.length) return <Empty text="No field mismatches." />;
    return (
        <div className="overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {showWeek && <TableHead>Week</TableHead>}
                        <TableHead>Clock</TableHead>
                        <TableHead>EH ID</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>EH</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.flatMap((m) => {
                        const fieldCount = Object.keys(m.diff).length;
                        return Object.entries(m.diff).map(([field, pair], i) => (
                            <TableRow key={`${m.clock.id}-${field}`}>
                                {i === 0 && (
                                    <>
                                        {showWeek && <TableCell rowSpan={fieldCount} className="font-mono text-xs">{m.week_ending}</TableCell>}
                                        <TableCell rowSpan={fieldCount}>#{m.clock.id}</TableCell>
                                        <TableCell rowSpan={fieldCount}>{m.eh.eh_id}</TableCell>
                                        <TableCell rowSpan={fieldCount}>
                                            {m.clock.employee_name || m.clock.eh_employee_id}
                                            {m.clock.employee_archived && (
                                                <Badge variant="outline" className="ml-2">archived</Badge>
                                            )}
                                        </TableCell>
                                    </>
                                )}
                                <TableCell className="font-mono text-xs">{field}</TableCell>
                                <TableCell className="font-mono text-xs">{fmtVal(pair.local)}</TableCell>
                                <TableCell className="font-mono text-xs">{fmtVal(pair.eh)}</TableCell>
                            </TableRow>
                        ));
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function DeletableLocalTable({
    rows,
    emptyText,
    showEhId = false,
    busy,
    busyKey,
    onDelete,
    showWeek = false,
}: {
    rows: LocalRow[];
    emptyText: string;
    showEhId?: boolean;
    busy: string | null;
    busyKey: string;
    onDelete: (ids: number[]) => void;
    showWeek?: boolean;
}) {
    if (!rows.length) return <Empty text={emptyText} />;

    const allIds = rows.map((r) => r.id);
    const isBusy = busy === busyKey;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{rows.length} row(s)</div>
                <ConfirmButton
                    title={`Soft-delete all ${rows.length} row(s)?`}
                    description="They'll be soft-deleted (recoverable via the database). EH is the source of truth — if these were paid shifts, EH would still have them."
                    actionLabel="Delete all"
                    onConfirm={() => onDelete(allIds)}
                    trigger={
                        <Button variant="destructive" size="sm" disabled={isBusy}>
                            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete all
                        </Button>
                    }
                />
            </div>
            <div className="overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {showWeek && <TableHead>Week</TableHead>}
                            <TableHead>Clock #</TableHead>
                            {showEhId && <TableHead>EH ID</TableHead>}
                            <TableHead>Employee</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.id}>
                                {showWeek && <TableCell className="font-mono text-xs">{r.week_ending}</TableCell>}
                                <TableCell>#{r.id}</TableCell>
                                {showEhId && <TableCell className="font-mono text-xs">{r.eh_timesheet_id || '—'}</TableCell>}
                                <TableCell>
                                    {r.employee_name || r.eh_employee_id || '—'}
                                    {r.employee_archived && <Badge variant="outline" className="ml-2">archived</Badge>}
                                </TableCell>
                                <TableCell>{r.location_name || r.eh_location_id || '—'}</TableCell>
                                <TableCell className="font-mono text-xs">{r.clock_in || '—'}</TableCell>
                                <TableCell className="font-mono text-xs">
                                    {r.clock_out || <Badge variant="destructive">incomplete</Badge>}
                                </TableCell>
                                <TableCell>{r.hours_worked.toFixed(2)}</TableCell>
                                <TableCell>{r.status || '—'}</TableCell>
                                <TableCell>
                                    <ConfirmButton
                                        title="Soft-delete this clock?"
                                        description={`Clock #${r.id} for ${r.employee_name || r.eh_employee_id || 'unknown employee'}.`}
                                        actionLabel="Delete"
                                        onConfirm={() => onDelete([r.id])}
                                        trigger={
                                            <Button variant="ghost" size="sm" disabled={isBusy}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        }
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function EhOnlyTable({ rows, showWeek = false }: { rows: EhRow[]; showWeek?: boolean }) {
    if (!rows.length) return <Empty text="No EH-only timesheets." />;
    return (
        <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
                These exist in EH but not locally. Use the "Pull from EH" button at the top to bring them in.
            </div>
            <div className="overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {showWeek && <TableHead>Week</TableHead>}
                            <TableHead>EH ID</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.eh_id}>
                                {showWeek && <TableCell className="font-mono text-xs">{r.week_ending}</TableCell>}
                                <TableCell className="font-mono text-xs">{r.eh_id}</TableCell>
                                <TableCell>{r.employee_id}</TableCell>
                                <TableCell>{r.location_id}</TableCell>
                                <TableCell className="font-mono text-xs">{r.start_time}</TableCell>
                                <TableCell className="font-mono text-xs">{r.end_time}</TableCell>
                                <TableCell>{r.status}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function ConfirmButton({
    title,
    description,
    actionLabel,
    onConfirm,
    trigger,
}: {
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
    trigger: React.ReactNode;
}) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>{actionLabel}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function Empty({ text }: { text: string }) {
    return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

export default Reconcile;

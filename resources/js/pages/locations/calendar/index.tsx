import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type LocationBase } from '@/layouts/location-layout';
import { type BreadcrumbItem } from '@/types';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import FullCalendar from '@fullcalendar/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Settings2, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type ProjectEventType = 'safety' | 'industrial_action' | 'weather' | 'other';
type CalendarView = 'dayGridMonth' | 'multiMonthYear';

interface GlobalEvent {
    id: number;
    title: string;
    start: string;
    end: string;
    type: 'public_holiday' | 'rdo';
    source: 'global';
}

interface ProjectEvent {
    id: number;
    title: string;
    start: string;
    end: string;
    type: ProjectEventType;
    notes: string | null;
    source: 'project';
}

interface PageProps {
    location: LocationBase;
    workingDays: number[];
    globalEvents: GlobalEvent[];
    projectEvents: ProjectEvent[];
    [key: string]: unknown;
}

const PROJECT_TYPE_META: Record<ProjectEventType, { label: string; hex: string; dotClass: string }> = {
    safety:            { label: 'Safety',            hex: '#ef4444', dotClass: 'bg-red-500' },
    industrial_action: { label: 'Industrial Action', hex: '#f97316', dotClass: 'bg-orange-500' },
    weather:           { label: 'Weather',           hex: '#0ea5e9', dotClass: 'bg-sky-500' },
    other:             { label: 'Other',             hex: '#64748b', dotClass: 'bg-slate-500' },
};

const GLOBAL_TYPE_META = {
    public_holiday: { label: 'Public Holiday', hex: '#3b82f6', dotClass: 'bg-blue-500' },
    rdo:            { label: 'RDO',            hex: '#f59e0b', dotClass: 'bg-amber-500' },
} as const;

const WEEKDAYS: { value: number; short: string; long: string }[] = [
    { value: 1, short: 'Mon', long: 'Monday' },
    { value: 2, short: 'Tue', long: 'Tuesday' },
    { value: 3, short: 'Wed', long: 'Wednesday' },
    { value: 4, short: 'Thu', long: 'Thursday' },
    { value: 5, short: 'Fri', long: 'Friday' },
    { value: 6, short: 'Sat', long: 'Saturday' },
    { value: 0, short: 'Sun', long: 'Sunday' },
];

export default function ProjectCalendar() {
    const { location, workingDays: initialWorkingDays, globalEvents, projectEvents: initialProjectEvents } = usePage<PageProps>().props;

    const [projectEvents, setProjectEvents] = useState<ProjectEvent[]>(initialProjectEvents);
    const [workingDays, setWorkingDays] = useState<number[]>(initialWorkingDays ?? [1, 2, 3, 4, 5]);
    const [savedWorkingDays, setSavedWorkingDays] = useState<number[]>(initialWorkingDays ?? [1, 2, 3, 4, 5]);
    const [savingWorkingDays, setSavingWorkingDays] = useState(false);
    const [view, setView] = useState<CalendarView>('dayGridMonth');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ProjectEvent | null>(null);
    const [form, setForm] = useState<{ title: string; start: string; end: string; type: ProjectEventType; notes: string }>({
        title: '',
        start: '',
        end: '',
        type: 'safety',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [workingWeekDialogOpen, setWorkingWeekDialogOpen] = useState(false);
    const calendarRef = useRef<FullCalendar>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Calendar', href: `/locations/${location.id}/calendar` },
    ];

    const fcEvents = useMemo(() => {
        const global = globalEvents.map((e) => ({
            id: `g-${e.id}`,
            title: e.title,
            start: e.start,
            end: addDay(e.end),
            allDay: true,
            extendedProps: { source: 'global' as const, type: e.type },
            editable: false,
            display: 'block',
            backgroundColor: GLOBAL_TYPE_META[e.type].hex,
            borderColor: GLOBAL_TYPE_META[e.type].hex,
        }));
        const project = projectEvents.map((e) => ({
            id: `p-${e.id}`,
            title: e.title,
            start: e.start,
            end: addDay(e.end),
            allDay: true,
            extendedProps: { source: 'project' as const, type: e.type, notes: e.notes, rawId: e.id },
            display: 'block',
            backgroundColor: PROJECT_TYPE_META[e.type].hex,
            borderColor: PROJECT_TYPE_META[e.type].hex,
        }));
        return [...global, ...project];
    }, [globalEvents, projectEvents]);

    /** Map YYYY-MM-DD → highlight kind for day-cell shading. */
    const dayKindMap = useMemo(() => {
        const map = new Map<string, 'holiday' | 'rdo' | 'project'>();
        // RDO first, then holiday (holiday wins if both), then project (wins overall).
        for (const e of globalEvents) {
            if (e.type !== 'rdo') continue;
            for (const d of eachDay(e.start, e.end)) map.set(d, 'rdo');
        }
        for (const e of globalEvents) {
            if (e.type !== 'public_holiday') continue;
            for (const d of eachDay(e.start, e.end)) map.set(d, 'holiday');
        }
        for (const e of projectEvents) {
            for (const d of eachDay(e.start, e.end)) map.set(d, 'project');
        }
        return map;
    }, [globalEvents, projectEvents]);

    const dayCellClassNames = (arg: { date: Date }): string[] => {
        const iso = toIso(arg.date);
        const classes: string[] = [];
        const kind = dayKindMap.get(iso);
        if (kind === 'holiday') classes.push('pcal-day-holiday');
        else if (kind === 'rdo') classes.push('pcal-day-rdo');
        else if (kind === 'project') classes.push('pcal-day-project');

        const dow = arg.date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        if (!workingDays.includes(dow)) {
            classes.push(isWeekend ? 'pcal-day-weekend' : 'pcal-day-off');
        }
        return classes;
    };

    const handleViewChange = (v: CalendarView) => {
        setView(v);
        calendarRef.current?.getApi().changeView(v);
    };

    const openCreate = (dateStr: string) => {
        setEditing(null);
        setForm({ title: '', start: dateStr, end: dateStr, type: 'safety', notes: '' });
        setDialogOpen(true);
    };

    const openEdit = (event: ProjectEvent) => {
        setEditing(event);
        setForm({
            title: event.title,
            start: event.start,
            end: event.end,
            type: event.type,
            notes: event.notes ?? '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.start || !form.end || !form.type) {
            toast.error('Please fill in all required fields');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                const updated = await api.patch<ProjectEvent>(`/project-calendar/events/${editing.id}`, form);
                setProjectEvents((prev) => prev.map((e) => (e.id === editing.id ? { ...e, ...updated, source: 'project' } : e)));
                toast.success('Event updated');
            } else {
                const created = await api.post<ProjectEvent>(`/locations/${location.id}/calendar/events`, form);
                setProjectEvents((prev) => [...prev, { ...created, source: 'project' }]);
                toast.success('Event created');
            }
            setDialogOpen(false);
        } catch {
            toast.error('Failed to save event');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editing) return;
        if (!confirm('Delete this event?')) return;
        setSaving(true);
        try {
            await api.delete(`/project-calendar/events/${editing.id}`);
            setProjectEvents((prev) => prev.filter((e) => e.id !== editing.id));
            setDialogOpen(false);
            toast.success('Event deleted');
        } catch {
            toast.error('Failed to delete event');
        } finally {
            setSaving(false);
        }
    };

    const toggleWorkingDay = (day: number) => {
        setWorkingDays((prev) => {
            if (prev.includes(day)) {
                return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
            }
            return [...prev, day].sort();
        });
    };

    const handleSaveWorkingDays = async () => {
        setSavingWorkingDays(true);
        try {
            await api.patch(`/locations/${location.id}/calendar/working-days`, { working_days: workingDays });
            setSavedWorkingDays([...workingDays]);
            toast.success('Working days updated');
        } catch {
            toast.error('Failed to update working days');
        } finally {
            setSavingWorkingDays(false);
        }
    };

    const handleResetWorkingDays = () => setWorkingDays([...savedWorkingDays]);

    const workingDaysDirty = !sameSet(workingDays, savedWorkingDays);
    const workingDaysLabel = formatWorkingDays(savedWorkingDays);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Calendar - ${location.name}`} />

            <div className="flex flex-col gap-4 p-4 md:p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Calendar */}
                    <Card className="overflow-hidden">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 space-y-0 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <CardTitle className="text-base">Project Calendar</CardTitle>
                                <span className="text-muted-foreground truncate text-sm">{location.name}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setWorkingWeekDialogOpen(true)}
                                >
                                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Working Week:</span>
                                    <span className="font-medium">{workingDaysLabel}</span>
                                </Button>
                                <Button asChild variant="outline" size="sm" className="h-8" nativeButton={false}>
                                    <Link href={`/locations/${location.id}/schedule`}>
                                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                                        Schedule
                                    </Link>
                                </Button>
                                <div className="bg-muted inline-flex items-center rounded-md p-0.5">
                                    {(['dayGridMonth', 'multiMonthYear'] as CalendarView[]).map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => handleViewChange(v)}
                                            className={cn(
                                                'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                                                view === v
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            {v === 'dayGridMonth' ? 'Month' : 'Year'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <Separator />
                        <CardContent className="p-2 pt-2 sm:p-3 sm:pt-2">
                            <div className={cn('project-calendar-root', view === 'multiMonthYear' && 'pcal-year')}>
                                <FullCalendar
                                    ref={calendarRef}
                                    plugins={[dayGridPlugin, multiMonthPlugin, interactionPlugin]}
                                    initialView={view}
                                    events={view === 'multiMonthYear' ? [] : fcEvents}
                                    firstDay={1}
                                    height="auto"
                                    expandRows
                                    fixedWeekCount={false}
                                    multiMonthMaxColumns={4}
                                    multiMonthMinWidth={200}
                                    dayMaxEvents={3}
                                    dayCellClassNames={dayCellClassNames}
                                    dateClick={(arg) => openCreate(arg.dateStr)}
                                    eventClick={(arg) => {
                                        if (arg.event.extendedProps.source !== 'project') {
                                            toast.info('Global events are managed from the main Calendar page');
                                            return;
                                        }
                                        const rawId = arg.event.extendedProps.rawId as number;
                                        const evt = projectEvents.find((e) => e.id === rawId);
                                        if (evt) openEdit(evt);
                                    }}
                                    headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                                    buttonText={{ today: 'Today' }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Event' : 'New Non-Work Event'}</DialogTitle>
                        <DialogDescription>
                            This day will count as non-working on the project schedule, in addition to weekends and global events.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                placeholder="e.g. Site closed — cyclone"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="start">From</Label>
                                <Input
                                    id="start"
                                    type="date"
                                    value={form.start}
                                    onChange={(e) => setForm({ ...form, start: e.currentTarget.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end">To</Label>
                                <Input
                                    id="end"
                                    type="date"
                                    value={form.end}
                                    onChange={(e) => setForm({ ...form, end: e.currentTarget.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Type</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(PROJECT_TYPE_META) as ProjectEventType[]).map((t) => {
                                    const active = form.type === t;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setForm({ ...form, type: t })}
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                                active
                                                    ? 'border-primary bg-primary/5 text-foreground'
                                                    : 'text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                                            )}
                                        >
                                            <span className={cn('h-2 w-2 rounded-full', PROJECT_TYPE_META[t].dotClass)} />
                                            {PROJECT_TYPE_META[t].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Optional context"
                                rows={3}
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between">
                        {editing ? (
                            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive hover:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        ) : <span />}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={workingWeekDialogOpen}
                onOpenChange={(open) => {
                    if (!open) handleResetWorkingDays();
                    setWorkingWeekDialogOpen(open);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configure Working Week</DialogTitle>
                        <DialogDescription>
                            Choose which days are treated as working days on this project. Non-selected days will be shaded as non-working on
                            the schedule.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-7 gap-1.5 py-2">
                        {WEEKDAYS.map((d) => {
                            const active = workingDays.includes(d.value);
                            return (
                                <button
                                    key={d.value}
                                    type="button"
                                    aria-pressed={active}
                                    aria-label={d.long}
                                    onClick={() => toggleWorkingDay(d.value)}
                                    className={cn(
                                        'rounded-md border py-2.5 text-xs font-medium transition-all',
                                        active
                                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                            : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                                    )}
                                >
                                    {d.short}
                                </button>
                            );
                        })}
                    </div>

                    <DialogFooter className="sm:justify-between">
                        <div className="text-muted-foreground text-xs">
                            {workingDays.length} of 7 days working
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    handleResetWorkingDays();
                                    setWorkingWeekDialogOpen(false);
                                }}
                                disabled={savingWorkingDays}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    await handleSaveWorkingDays();
                                    setWorkingWeekDialogOpen(false);
                                }}
                                disabled={!workingDaysDirty || savingWorkingDays}
                            >
                                {savingWorkingDays ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function eachDay(start: string, end: string): string[] {
    const out: string[] = [];
    const d = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    while (d <= endD) {
        out.push(toIso(d));
        d.setDate(d.getDate() + 1);
    }
    return out;
}

function toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatWorkingDays(days: number[]): string {
    if (days.length === 0) return '—';
    const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const labels = sorted.map((d) => WEEKDAYS.find((w) => w.value === d)?.short ?? '');
    if (sameSet(days, [1, 2, 3, 4, 5])) return 'Mon–Fri';
    if (sameSet(days, [1, 2, 3, 4, 5, 6])) return 'Mon–Sat';
    if (sameSet(days, [0, 1, 2, 3, 4, 5, 6])) return '7 days';
    return labels.join(', ');
}

function addDay(isoDate: string): string {
    // Accept either 'YYYY-MM-DD' or a full ISO like '2026-04-15T00:00:00.000000Z'.
    const datePart = (isoDate ?? '').slice(0, 10);
    const d = new Date(datePart + 'T00:00:00');
    if (isNaN(d.getTime())) return datePart; // fall back to original if unparseable
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}

function sameSet(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((x) => setB.has(x));
}

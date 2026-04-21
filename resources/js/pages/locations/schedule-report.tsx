import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { Head, Link, usePage } from '@inertiajs/react';
import { addMonths, differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns';
import { ArrowLeft, Printer } from 'lucide-react';
import { useMemo } from 'react';

interface ProjectTask {
    id: number;
    parent_id: number | null;
    name: string;
    sort_order: number;
    start_date: string | null;
    end_date: string | null;
    baseline_start: string | null;
    baseline_finish: string | null;
    responsible: string | null;
    is_critical: boolean;
}

interface TaskLink {
    id: number;
    source_id: number;
    target_id: number;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    lag_days: number | null;
}

interface LocationInfo {
    id: number;
    name: string;
    external_id?: string | null;
    address_line1?: string | null;
    city?: string | null;
}

interface PageProps {
    location: LocationInfo;
    tasks: ProjectTask[];
    links: TaskLink[];
    generatedAt: string;
    preparedBy?: string | null;
    [key: string]: unknown;
}

type Kind = 'on-track' | 'ahead' | 'slipped' | 'no-baseline';

interface Row {
    task: ProjectTask;
    depth: number;
    hasChildren: boolean;
    slipDays: number | null;
    kind: Kind;
    /** For slipped leaf tasks — the upstream task whose slip likely caused this one. */
    causedBy?: { id: number; name: string; slipDays: number } | null;
}

function classify(task: ProjectTask): { days: number | null; kind: Kind } {
    if (!task.baseline_finish || !task.end_date) return { days: null, kind: 'no-baseline' };
    const diff = differenceInCalendarDays(parseISO(task.end_date), parseISO(task.baseline_finish));
    if (diff > 0) return { days: diff, kind: 'slipped' };
    if (diff < 0) return { days: diff, kind: 'ahead' };
    return { days: 0, kind: 'on-track' };
}

function buildRows(tasks: ProjectTask[], links: TaskLink[]): Row[] {
    const byParent = new Map<number | null, ProjectTask[]>();
    for (const t of tasks) {
        const arr = byParent.get(t.parent_id) ?? [];
        arr.push(t);
        byParent.set(t.parent_id, arr);
    }
    for (const [, arr] of byParent) arr.sort((a, b) => a.sort_order - b.sort_order);

    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const incomingBy = new Map<number, TaskLink[]>();
    for (const l of links) {
        const arr = incomingBy.get(l.target_id) ?? [];
        arr.push(l);
        incomingBy.set(l.target_id, arr);
    }

    const findCause = (taskId: number): { id: number; name: string; slipDays: number } | null => {
        // Walk incoming links — pick the predecessor with the largest slip.
        let worst: { id: number; name: string; slipDays: number } | null = null;
        for (const link of incomingBy.get(taskId) ?? []) {
            const pred = taskById.get(link.source_id);
            if (!pred) continue;
            const c = classify(pred);
            if (c.kind !== 'slipped' || c.days == null) continue;
            if (!worst || c.days > worst.slipDays) {
                worst = { id: pred.id, name: pred.name, slipDays: c.days };
            }
        }
        return worst;
    };

    const rows: Row[] = [];
    const walk = (parentId: number | null, depth: number) => {
        for (const t of byParent.get(parentId) ?? []) {
            const hasChildren = (byParent.get(t.id)?.length ?? 0) > 0;
            const c = classify(t);
            const causedBy = !hasChildren && c.kind === 'slipped' ? findCause(t.id) : null;
            rows.push({ task: t, depth, hasChildren, slipDays: c.days, kind: c.kind, causedBy });
            walk(t.id, depth + 1);
        }
    };
    walk(null, 0);
    return rows;
}

function fmt(d: string | null): string {
    return d ? format(parseISO(d), 'dd/MM/yyyy') : '—';
}

function dayLabel(n: number): string {
    return Math.abs(n) === 1 ? 'day' : 'days';
}

export default function ScheduleReport() {
    const { location, tasks, links, generatedAt, preparedBy } = usePage<PageProps>().props;
    const rows = useMemo(() => buildRows(tasks, links), [tasks, links]);

    const summary = useMemo(() => {
        let baselineMax: Date | null = null;
        let currentMax: Date | null = null;
        let minD: Date | null = null;
        let maxD: Date | null = null;
        let leafCount = 0;
        let maxSlipMagnitude = 1;
        const slipped: Row[] = [];
        const childrenByParent = new Map<number, Row[]>();

        for (const r of rows) {
            if (r.task.parent_id != null) {
                const arr = childrenByParent.get(r.task.parent_id) ?? [];
                arr.push(r);
                childrenByParent.set(r.task.parent_id, arr);
            }

            for (const s of [r.task.baseline_start, r.task.baseline_finish, r.task.start_date, r.task.end_date]) {
                if (!s) continue;
                const d = parseISO(s);
                if (!minD || d < minD) minD = d;
                if (!maxD || d > maxD) maxD = d;
            }

            if (r.hasChildren) continue;
            leafCount++;

            if (r.task.baseline_finish) {
                const d = parseISO(r.task.baseline_finish);
                if (!baselineMax || d > baselineMax) baselineMax = d;
            }
            if (r.task.end_date) {
                const d = parseISO(r.task.end_date);
                if (!currentMax || d > currentMax) currentMax = d;
            }
            if (r.kind === 'slipped') slipped.push(r);

            if (r.slipDays != null && Math.abs(r.slipDays) > maxSlipMagnitude) maxSlipMagnitude = Math.abs(r.slipDays);
        }

        slipped.sort((a, b) => (b.slipDays ?? 0) - (a.slipDays ?? 0));

        const range = minD && maxD
            ? { start: minD as Date, end: maxD as Date, totalDays: Math.max(1, differenceInCalendarDays(maxD, minD)) }
            : null;
        const projectSlip = baselineMax && currentMax ? differenceInCalendarDays(currentMax, baselineMax) : null;

        return { baselineMax, currentMax, projectSlip, range, leafCount, slipped, maxSlipMagnitude, childrenByParent };
    }, [rows]);

    const monthTicks = useMemo(() => {
        if (!summary.range) return [];
        const ticks: { date: Date; leftPct: number; label: string }[] = [];
        let cursor = startOfMonth(summary.range.start);
        while (cursor <= summary.range.end) {
            const offsetDays = differenceInCalendarDays(cursor, summary.range.start);
            const leftPct = (offsetDays / summary.range.totalDays) * 100;
            if (leftPct >= 0 && leftPct <= 100) {
                ticks.push({ date: cursor, leftPct, label: format(cursor, 'MMM yy') });
            }
            cursor = addMonths(cursor, 1);
        }
        return ticks;
    }, [summary.range]);

    const { baselineMax, currentMax, projectSlip, range: projectRange, leafCount, slipped, maxSlipMagnitude, childrenByParent } = summary;
    const generatedDate = format(parseISO(generatedAt), 'dd/MM/yyyy');

    const headlineTone =
        projectSlip == null ? 'neutral' : projectSlip > 0 ? 'late' : projectSlip < 0 ? 'ahead' : 'ontrack';
    const headlineLabel =
        projectSlip == null
            ? 'No baseline set'
            : projectSlip > 0
              ? `${projectSlip} ${dayLabel(projectSlip)} late`
              : projectSlip < 0
                ? `${Math.abs(projectSlip)} ${dayLabel(projectSlip)} ahead`
                : 'On programme';

    const summarySentence = (() => {
        if (projectSlip == null) return 'A baseline programme has not been set for this project yet.';
        if (projectSlip > 0) {
            const top = slipped.slice(0, 3).map((r) => r.task.name);
            const driverText =
                slipped.length === 0
                    ? ''
                    : ` Driven by ${slipped.length} delayed task${slipped.length === 1 ? '' : 's'}` +
                      (top.length ? `, including ${top.join(', ')}.` : '.');
            return `Currently forecasting completion ${projectSlip} working ${dayLabel(projectSlip)} past the contract finish date.${driverText}`;
        }
        if (projectSlip < 0) return `Currently forecasting completion ${Math.abs(projectSlip)} working ${dayLabel(projectSlip)} ahead of the contract finish date.`;
        return 'Currently forecasting completion in line with the contract finish date.';
    })();

    return (
        <AppLayout>
            <Head title={`Programme Variance — ${location.name}`} />

            <style>{`
                @media print {
                    @page { size: A3 landscape; margin: 12mm; }
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .print-root { padding: 0 !important; max-width: none !important; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr { page-break-inside: avoid; }
                    .page-break { page-break-before: always; }
                    .keep-together { page-break-inside: avoid; }
                }
            `}</style>

            <div className="print-root mx-auto max-w-[1800px] p-6 print:p-0">
                {/* Screen-only controls */}
                <div className="no-print mb-4 flex items-center justify-between">
                    <Link
                        href={`/locations/${location.id}/schedule`}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to schedule
                    </Link>
                    <Button onClick={() => window.print()} size="sm">
                        <Printer className="mr-1.5 h-4 w-4" /> Print / Save as PDF
                    </Button>
                </div>

                {/* Identity bar */}
                <div className="mb-5 flex items-end justify-between gap-6 border-b pb-3 text-xs">
                    <div>
                        <div className="text-lg font-semibold leading-tight">{location.name}</div>
                        <div className="text-muted-foreground mt-0.5">
                            Programme variance
                            {location.external_id && <> &middot; Job #{location.external_id}</>}
                            {location.address_line1 && (
                                <>
                                    {' '}&middot; {location.address_line1}
                                    {location.city ? `, ${location.city}` : ''}
                                </>
                            )}
                        </div>
                    </div>
                    <div className="text-muted-foreground text-right text-[11px]">
                        <div>
                            As of <span className="text-foreground font-medium">{generatedDate}</span>
                        </div>
                        {preparedBy && (
                            <div>
                                Prepared by <span className="text-foreground font-medium">{preparedBy}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* HERO — the headline */}
                <section className="keep-together mb-6">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <div
                            className={cn(
                                'text-xl leading-none font-semibold',
                                headlineTone === 'late' && 'text-amber-700',
                                headlineTone === 'ahead' && 'text-emerald-700',
                                headlineTone === 'ontrack' && 'text-emerald-700',
                            )}
                        >
                            {headlineLabel}
                        </div>
                        {baselineMax && currentMax && projectSlip !== 0 && (
                            <div className="text-muted-foreground text-[11px] tabular-nums">
                                {format(baselineMax, 'dd/MM/yyyy')}
                                <span className="mx-1">→</span>
                                <span className="text-foreground">{format(currentMax, 'dd/MM/yyyy')}</span>
                            </div>
                        )}
                        {slipped.length > 0 && (
                            <span className="text-muted-foreground text-[11px]">
                                <span className="text-amber-700 font-medium">{slipped.length}</span>
                                {' '}of {leafCount} task{leafCount === 1 ? '' : 's'} slipped
                            </span>
                        )}
                    </div>
                    {projectSlip !== 0 && projectSlip != null && (
                        <p className="text-muted-foreground mt-1.5 max-w-2xl text-xs">{summarySentence}</p>
                    )}
                </section>

                {/* DELAYED TASKS — claim section */}
                {slipped.length > 0 && (
                    <section className="keep-together mb-8">
                        <h2 className="mb-1 text-sm font-semibold">Delayed tasks</h2>
                        <p className="text-muted-foreground mb-3 text-xs">
                            Sorted by slip severity. Where shown, the upstream task driving the delay is identified.
                        </p>
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr className="border-y text-left">
                                    <th className="text-muted-foreground py-2 pr-2 font-medium">Task</th>
                                    <th className="text-muted-foreground px-2 py-2 font-medium">Contract finish</th>
                                    <th className="text-muted-foreground px-2 py-2 font-medium">Forecast finish</th>
                                    <th className="text-muted-foreground px-2 py-2 font-medium">Slip</th>
                                    <th className="text-muted-foreground px-2 py-2 font-medium">Driven by</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slipped.map((r) => (
                                    <tr key={r.task.id} className="border-b border-l-2 border-l-amber-400 align-top">
                                        <td className="py-2 pr-2 pl-2.5 font-medium">
                                            {r.task.name}
                                            {r.task.is_critical && <span className="ml-1.5 text-[10px] font-medium text-amber-700">critical</span>}
                                        </td>
                                        <td className="text-muted-foreground px-2 py-2 tabular-nums whitespace-nowrap">{fmt(r.task.baseline_finish)}</td>
                                        <td className="px-2 py-2 font-medium tabular-nums whitespace-nowrap">{fmt(r.task.end_date)}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <SlipBar slipDays={r.slipDays ?? 0} max={maxSlipMagnitude} />
                                        </td>
                                        <td className="text-muted-foreground px-2 py-2 text-[10px]">
                                            {r.causedBy ? (
                                                <>
                                                    <span className="text-foreground">{r.causedBy.name}</span>{' '}
                                                    <span className="text-amber-700 tabular-nums">+{r.causedBy.slipDays}d</span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground/60">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                {slipped.length === 0 && projectSlip != null && projectSlip <= 0 && (
                    <section className="keep-together text-muted-foreground mb-8 text-xs">
                        All tasks with a baseline are tracking on or ahead of the contract programme.
                    </section>
                )}

                {/* FULL PROGRAMME — supporting reference, gantt-first */}
                <section className="page-break">
                    <h2 className="mb-1 text-sm font-semibold">Full programme</h2>
                    <p className="text-muted-foreground mb-3 text-xs">
                        Baseline above forecast on a shared timeline. Faint vertical lines mark month boundaries.
                    </p>
                    <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '70%' }} />
                        </colgroup>
                        <thead>
                            <tr className="border-y text-left">
                                <th className="py-2 pr-3 align-bottom font-semibold">Task</th>
                                <th className="px-2 py-2 align-bottom font-semibold">
                                    {projectRange ? (
                                        <div className="relative h-5">
                                            {monthTicks.map((tick, i) => (
                                                <span
                                                    key={i}
                                                    className="text-muted-foreground absolute top-0 -translate-x-1/2 text-[9px] font-normal whitespace-nowrap"
                                                    style={{ left: `${tick.leftPct}%` }}
                                                >
                                                    {tick.label}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        'Timeline'
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const { task, depth, hasChildren, slipDays, kind } = r;

                                if (hasChildren) {
                                    const childRows = childrenByParent.get(task.id) ?? [];
                                    const childLeavesSlipped = childRows.filter((c) => !c.hasChildren && c.kind === 'slipped').length;
                                    const worstChildSlip = Math.max(0, ...childRows.filter((c) => !c.hasChildren && c.slipDays != null).map((c) => c.slipDays!));
                                    return (
                                        <tr key={task.id} className="bg-muted/30 border-b align-middle print:bg-zinc-100">
                                            <td className="py-1.5 pr-3 font-semibold" style={{ paddingLeft: `${depth * 14 + 4}px` }}>
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="truncate">{task.name}</span>
                                                    {childLeavesSlipped > 0 && (
                                                        <span className="text-muted-foreground text-[10px] font-normal whitespace-nowrap">
                                                            {childLeavesSlipped} slipped · worst {worstChildSlip}d
                                                        </span>
                                                    )}
                                                </div>
                                                {(task.baseline_start || task.start_date) && (
                                                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-[9px] font-normal tabular-nums">
                                                        <span>
                                                            <span className="text-muted-foreground/70">Plan</span> {fmt(task.baseline_start)} – {fmt(task.baseline_finish)}
                                                        </span>
                                                        <span>
                                                            <span className="text-muted-foreground/70">Now</span> {fmt(task.start_date)} – {fmt(task.end_date)}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <TimelineBar
                                                    range={projectRange}
                                                    monthTicks={monthTicks}
                                                    baselineStart={task.baseline_start}
                                                    baselineFinish={task.baseline_finish}
                                                    currentStart={task.start_date}
                                                    currentFinish={task.end_date}
                                                    kind="group"
                                                />
                                            </td>
                                        </tr>
                                    );
                                }

                                const leftBorder =
                                    kind === 'slipped'
                                        ? 'border-l-2 border-l-amber-400'
                                        : kind === 'ahead'
                                          ? 'border-l-2 border-l-emerald-400'
                                          : 'border-l-2 border-l-transparent';

                                return (
                                    <tr key={task.id} className={cn('border-b align-middle', leftBorder)}>
                                        <td className="py-1.5 pr-3" style={{ paddingLeft: `${depth * 14 + 4}px` }}>
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="truncate">
                                                    {task.name}
                                                    {task.is_critical && <span className="ml-1.5 text-[10px] font-medium text-amber-700">critical</span>}
                                                </span>
                                                {slipDays != null && slipDays !== 0 && (
                                                    <span
                                                        className={cn(
                                                            'shrink-0 text-[10px] font-medium tabular-nums',
                                                            slipDays > 0 ? 'text-amber-700' : 'text-emerald-700',
                                                        )}
                                                    >
                                                        {slipDays > 0 ? `+${slipDays}d` : `${slipDays}d`}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-[9px] tabular-nums">
                                                <span>
                                                    <span className="text-muted-foreground/70">Plan</span> {fmt(task.baseline_start)} – {fmt(task.baseline_finish)}
                                                </span>
                                                <span>
                                                    <span className="text-muted-foreground/70">Now</span> {fmt(task.start_date)} – {fmt(task.end_date)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <TimelineBar
                                                range={projectRange}
                                                monthTicks={monthTicks}
                                                baselineStart={task.baseline_start}
                                                baselineFinish={task.baseline_finish}
                                                currentStart={task.start_date}
                                                currentFinish={task.end_date}
                                                kind={kind}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Legend */}
                    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-1.5 w-5 bg-zinc-400" /> Baseline
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2 w-5 bg-emerald-500" /> On track / ahead
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2 w-5 bg-amber-500" /> Slipped
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2 w-5 bg-zinc-700" /> Group roll-up
                        </span>
                    </div>
                </section>

            </div>
        </AppLayout>
    );
}

/** Mini gantt bar for one task — contract bar (gray) above current bar (coloured by slip).
 *  Shares a project-wide time axis with the column header so all rows align visually. */
function TimelineBar({
    range,
    monthTicks,
    baselineStart,
    baselineFinish,
    currentStart,
    currentFinish,
    kind,
}: {
    range: { start: Date; end: Date; totalDays: number } | null;
    monthTicks: { leftPct: number }[];
    baselineStart: string | null;
    baselineFinish: string | null;
    currentStart: string | null;
    currentFinish: string | null;
    kind: Kind | 'group';
}) {
    if (!range) return null;
    const positionFor = (s: string | null, e: string | null) => {
        if (!s || !e) return null;
        const sd = parseISO(s);
        const ed = parseISO(e);
        const leftPct = (differenceInCalendarDays(sd, range.start) / range.totalDays) * 100;
        const widthPct = Math.max(0.4, (differenceInCalendarDays(ed, sd) / range.totalDays) * 100);
        return { leftPct, widthPct };
    };
    const baseline = positionFor(baselineStart, baselineFinish);
    const current = positionFor(currentStart, currentFinish);

    const currentColor =
        kind === 'group'
            ? 'bg-zinc-700'
            : kind === 'slipped'
              ? 'bg-amber-500'
              : kind === 'ahead'
                ? 'bg-emerald-500'
                : 'bg-zinc-500';

    return (
        <div className="relative" style={{ width: '100%', height: 18 }}>
            {/* Faint month gridlines so bars read against the time axis */}
            {monthTicks.map((t, i) => (
                <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-zinc-200 print:bg-zinc-300"
                    style={{ left: `${t.leftPct}%` }}
                />
            ))}
            {/* Baseline bar — top, thin, gray */}
            {baseline && (
                <div
                    className="absolute top-1 h-2 bg-zinc-400 print:bg-zinc-500"
                    style={{ left: `${baseline.leftPct}%`, width: `${baseline.widthPct}%` }}
                    title={`Baseline: ${fmt(baselineStart)} → ${fmt(baselineFinish)}`}
                />
            )}
            {/* Current bar — bottom, thicker, coloured by slip status */}
            {current && (
                <div
                    className={cn('absolute top-4 h-2.5', currentColor)}
                    style={{ left: `${current.leftPct}%`, width: `${current.widthPct}%` }}
                    title={`Forecast: ${fmt(currentStart)} → ${fmt(currentFinish)}`}
                />
            )}
        </div>
    );
}

/** Inline horizontal bar for variance — visible at-a-glance comparison across rows.
 *  Negative slip extends left of the centre axis (ahead); positive extends right (late). */
function SlipBar({ slipDays, max, compact = false }: { slipDays: number; max: number; compact?: boolean }) {
    const width = compact ? 60 : 90;
    const halfWidth = width / 2;
    const magnitude = Math.min(Math.abs(slipDays) / max, 1);
    const barPx = Math.max(2, magnitude * halfWidth);
    const isLate = slipDays > 0;
    const isAhead = slipDays < 0;

    return (
        <div className="inline-flex items-center gap-2 align-middle">
            <div className="relative inline-block bg-zinc-200 print:bg-zinc-300" style={{ width, height: 8 }}>
                {/* centre axis */}
                <div className="absolute top-0 bottom-0 w-px bg-zinc-400" style={{ left: halfWidth - 0.5 }} />
                {(isLate || isAhead) && (
                    <div
                        className={cn('absolute top-0 bottom-0', isLate ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{
                            left: isLate ? halfWidth : halfWidth - barPx,
                            width: barPx,
                        }}
                    />
                )}
            </div>
            <span
                className={cn(
                    'text-[10px] font-medium tabular-nums',
                    isLate && 'text-amber-700',
                    isAhead && 'text-emerald-700',
                    !isLate && !isAhead && 'text-muted-foreground',
                )}
            >
                {slipDays > 0 ? `+${slipDays}d` : slipDays < 0 ? `${slipDays}d` : '0d'}
            </span>
        </div>
    );
}

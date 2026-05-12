import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ArrowUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface TimesheetRow {
    id: number;
    employee_name: string;
    eh_employee_id: number;
    date: string;
    day: string;
    clock_in: string;
    clock_out: string | null;
    hours: number;
    worktype_name: string;
    worktype_external_id: string | null;
    worktype_mapping_type: string | null;
    location_name: string;
    eh_location_id: number;
    status: string;
    nt_hours?: number;
    ot_hours?: number;
}

interface TimesheetsPageProps {
    rows: TimesheetRow[];
    category: Category;
    date_from: string;
    date_to: string;
    project_names: string[];
    project_ids: number[];
    truncated: boolean;
}

type Category =
    | 'nt'
    | 'ot'
    | 'worked'
    | 'weather'
    | 'safety'
    | 'al'
    | 'sick'
    | 'rdo'
    | 'ph'
    | 'lost'
    | 'non_standard'
    | 'available';

const CATEGORY_LABELS: Record<Category, string> = {
    nt: 'Normal Time',
    ot: 'Overtime',
    worked: 'Productive (Worked)',
    weather: 'Weather',
    safety: 'Safety',
    al: 'Annual Leave',
    sick: "Sick / Carer's Leave",
    rdo: 'Rostered Day Off',
    ph: 'Public Holiday',
    lost: 'Lost (all non-productive)',
    non_standard: 'Non-Standard',
    available: 'Available (all clocks)',
};

const CATEGORY_BLURBS: Record<Category, string> = {
    nt: 'Productive hours capped at 8/day per employee. Each row shows its NT portion based on the day total.',
    ot: 'Days where an employee\'s productive hours exceeded 8h. Rows are split into NT and OT portions.',
    worked: 'Every productive shift (NT + OT). Each row shows its NT/OT split for that day.',
    weather: 'Clocks at the project\'s Inclement Weather / Weather sub-locations.',
    safety: 'Clocks at the project\'s Safety sub-locations.',
    al: 'Annual Leave clocks.',
    sick: "Personal / Carer's Leave clocks.",
    rdo: 'RDO Taken / Rostered Day Off Taken clocks.',
    ph: 'Public Holiday clocks.',
    lost: 'Union of Weather + Safety + AL + Sick + RDO + PH.',
    non_standard: 'Clocks not classified by any bucket — typically Leave Without Pay, Industrial Action, pay-category adjustments, or clocks missing a work type.',
    available: 'Every clock in scope (any work type except Workcover).',
};

const formatHours = (value: number) => {
    if (!value) return '-';
    return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type SortKey = 'date' | 'employee_name' | 'hours' | 'worktype_name' | 'location_name';
type SortDir = 'asc' | 'desc';

export default function Timesheets({
    rows,
    category,
    date_from,
    date_to,
    project_names,
    project_ids,
    truncated,
}: TimesheetsPageProps) {
    const showNtOt = category === 'nt' || category === 'ot' || category === 'worked';
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const backUrl = `/labour-dashboard?projects=${project_ids.join(',')}&from=${date_from}&to=${date_to}`;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Labour Dashboard', href: backUrl },
        { title: CATEGORY_LABELS[category], href: '#' },
    ];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = q
            ? rows.filter(
                  (r) =>
                      r.employee_name.toLowerCase().includes(q) ||
                      r.worktype_name.toLowerCase().includes(q) ||
                      r.location_name.toLowerCase().includes(q) ||
                      r.date.includes(q),
              )
            : rows;
        const sign = sortDir === 'asc' ? 1 : -1;
        return [...base].sort((a, b) => {
            const av = a[sortKey] as string | number;
            const bv = b[sortKey] as string | number;
            if (typeof av === 'number' && typeof bv === 'number') return sign * (av - bv);
            return sign * String(av).localeCompare(String(bv));
        });
    }, [rows, search, sortKey, sortDir]);

    const totals = useMemo(
        () => ({
            hours: filtered.reduce((s, r) => s + r.hours, 0),
            nt: filtered.reduce((s, r) => s + (r.nt_hours ?? 0), 0),
            ot: filtered.reduce((s, r) => s + (r.ot_hours ?? 0), 0),
            employees: new Set(filtered.map((r) => r.eh_employee_id)).size,
        }),
        [filtered],
    );

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const onCategoryChange = (next: Category) => {
        router.get(
            '/labour-dashboard/timesheets',
            {
                location_ids: project_ids.join(','),
                date_from,
                date_to,
                category: next,
            },
            { preserveScroll: false, preserveState: false },
        );
    };

    const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
        <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-foreground">
            {label}
            <ArrowUpDown className={cn('h-3 w-3 shrink-0', sortKey === k && 'text-foreground')} />
        </button>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Timesheets — ${CATEGORY_LABELS[category]}`} />

            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <Link href={backUrl} className="inline-flex w-fit">
                            <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Back to Labour Dashboard
                            </Button>
                        </Link>
                        <div className="flex flex-wrap items-baseline gap-2">
                            <h1 className="text-xl font-semibold">{CATEGORY_LABELS[category]}</h1>
                            <span className="text-sm text-muted-foreground">timesheets</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{CATEGORY_BLURBS[category]}</p>
                    </div>

                    {/* Summary tiles */}
                    <div className="flex flex-wrap items-center gap-4">
                        <Summary label="Clocks" value={filtered.length.toLocaleString()} />
                        <Summary label="Employees" value={totals.employees.toLocaleString()} />
                        <Summary label="Hours" value={formatHours(totals.hours)} />
                        {showNtOt && (
                            <>
                                <Summary label="NT" value={formatHours(totals.nt)} />
                                <Summary label="OT" value={formatHours(totals.ot)} />
                            </>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/20 p-3 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Projects:</span>
                        <span className="font-medium">{project_names.join(', ') || '—'}</span>
                    </div>
                    <span className="text-muted-foreground">·</span>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Range:</span>
                        <span className="font-medium">
                            {date_from} → {date_to}
                        </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-muted-foreground">Category:</span>
                        <Select value={category} onValueChange={(v) => onCategoryChange(v as Category)}>
                            <SelectTrigger className="h-8 w-[220px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                                    <SelectItem key={c} value={c} className="text-xs">
                                        {CATEGORY_LABELS[c]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter employee / work type / location…"
                                className="h-8 w-[280px] pl-7 text-xs"
                            />
                        </div>
                    </div>
                </div>

                {truncated && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                        Result capped at 10,000 rows. Narrow the date range or projects to see everything.
                    </div>
                )}

                {/* Table */}
                <div className="overflow-hidden rounded-md border">
                    <Table className="text-xs">
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead><SortButton k="date" label="Date" /></TableHead>
                                <TableHead className="w-12">Day</TableHead>
                                <TableHead><SortButton k="employee_name" label="Employee" /></TableHead>
                                <TableHead><SortButton k="worktype_name" label="Work Type" /></TableHead>
                                <TableHead><SortButton k="location_name" label="Location" /></TableHead>
                                <TableHead className="text-right"><div className="ml-auto w-fit"><SortButton k="hours" label="Hours" /></div></TableHead>
                                {showNtOt && (
                                    <>
                                        <TableHead className="text-right">NT</TableHead>
                                        <TableHead className="text-right">OT</TableHead>
                                    </>
                                )}
                                <TableHead className="w-24">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={showNtOt ? 9 : 7} className="py-8 text-center text-muted-foreground">
                                        No timesheets match this drill-through.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="tabular-nums">{row.date}</TableCell>
                                        <TableCell className="text-muted-foreground">{row.day}</TableCell>
                                        <TableCell className="font-medium">{row.employee_name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{row.worktype_name}</span>
                                                {(row.worktype_external_id || (row.worktype_mapping_type && row.worktype_mapping_type !== 'WorkType')) && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                        {row.worktype_external_id && <span>{row.worktype_external_id}</span>}
                                                        {row.worktype_mapping_type && row.worktype_mapping_type !== 'WorkType' && (
                                                            <Badge variant="outline" className="px-1 py-0 text-[9px]">
                                                                {row.worktype_mapping_type}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{row.location_name}</TableCell>
                                        <TableCell className="text-right tabular-nums">{formatHours(row.hours)}</TableCell>
                                        {showNtOt && (
                                            <>
                                                <TableCell className="text-right tabular-nums">{formatHours(row.nt_hours ?? 0)}</TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right tabular-nums',
                                                        (row.ot_hours ?? 0) > 0 && 'font-semibold text-orange-600 dark:text-orange-400',
                                                    )}
                                                >
                                                    {formatHours(row.ot_hours ?? 0)}
                                                </TableCell>
                                            </>
                                        )}
                                        <TableCell>
                                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                                {row.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                            {filtered.length > 0 && (
                                <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={5}>Total</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatHours(totals.hours)}</TableCell>
                                    {showNtOt && (
                                        <>
                                            <TableCell className="text-right tabular-nums">{formatHours(totals.nt)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatHours(totals.ot)}</TableCell>
                                        </>
                                    )}
                                    <TableCell />
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="text-sm font-semibold tabular-nums">{value}</span>
        </div>
    );
}

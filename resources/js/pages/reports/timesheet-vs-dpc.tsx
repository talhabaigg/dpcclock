import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { CalendarIcon, Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { useEffect, useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/' },
    { title: 'Timesheet vs DPC', href: '/reports/timesheet-vs-dpc' },
];

type LocationOption = { id: number; name: string; external_id: string | null };
type UploadOption = { id: number; report_date: string | null; label: string };
type SelectedUpload = { id: number; report_date: string | null; report_date_formatted: string | null; original_filename: string };

type Row = {
    dpc_key: string;
    area: string;
    cost_code: string;
    description: string;
    matched: boolean;
    matched_sub_locations: { eh_location_id: string; name: string }[];
    timesheet_hours: number;
    dpc_hours: number;
    est_hours: number;
    variance: number;
    variance_pct: number | null;
};

type UnmatchedSubLocation = {
    sub_location_id: number;
    sub_location_name: string;
    external_id: string;
    suffix: string;
    timesheet_hours: number;
};

type Totals = {
    allocated_hours: number;
    unmatched_sub_hours: number;
    parent_hours: number;
    unallocated_hours: number;
    timesheet_hours: number;
    dpc_hours: number;
    allocated_variance: number;
    allocated_variance_pct: number | null;
    variance: number;
    variance_pct: number | null;
};

type ReportData = {
    success: boolean;
    uploads: UploadOption[];
    selected_upload: SelectedUpload | null;
    rows: Row[];
    unmatched_sublocations: UnmatchedSubLocation[];
    parent_hours: number;
    totals: Totals;
    message?: string;
};

const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

const tone = (n: number) => {
    if (n > 0.05) return 'text-amber-600 dark:text-amber-400';
    if (n < -0.05) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-muted-foreground';
};

export default function TimesheetVsDpcReport() {
    const { availableLocations } = usePage<{ availableLocations: LocationOption[] }>().props;

    const [locationId, setLocationId] = useState<string>('');
    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [uploadId, setUploadId] = useState<string>('latest');
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setUploadId('latest');
        setData(null);
        setHasSearched(false);
    }, [locationId]);

    const fetchData = async () => {
        if (!locationId) return;
        setLoading(true);
        setHasSearched(true);
        const params = new URLSearchParams();
        params.set('location_id', locationId);
        if (date?.from) params.set('date_from', format(date.from, 'yyyy-MM-dd'));
        if (date?.to) params.set('date_to', format(date.to, 'yyyy-MM-dd'));
        if (uploadId && uploadId !== 'latest') params.set('production_upload_id', uploadId);
        try {
            const res = await fetch(`/reports/timesheet-vs-dpc/data?${params}`);
            const json: ReportData = await res.json();
            setData(json.success ? json : null);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const matchedRows = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        return data.rows
            .filter((r) => r.matched && (r.dpc_hours > 0 || r.timesheet_hours > 0))
            .filter((r) => {
                if (!q) return true;
                return (
                    r.cost_code.toLowerCase().includes(q) ||
                    r.area.toLowerCase().includes(q) ||
                    r.description.toLowerCase().includes(q) ||
                    r.matched_sub_locations.some((s) => s.name.toLowerCase().includes(q))
                );
            })
            .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    }, [data, search]);

    const unmatchedDpcRows = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        return data.rows
            .filter((r) => !r.matched && r.dpc_hours > 0)
            .filter((r) => {
                if (!q) return true;
                return (
                    r.cost_code.toLowerCase().includes(q) ||
                    r.area.toLowerCase().includes(q) ||
                    r.description.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => b.dpc_hours - a.dpc_hours);
    }, [data, search]);

    const unmatchedTsRows = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        return data.unmatched_sublocations
            .filter((u) => u.timesheet_hours > 0)
            .filter((u) => {
                if (!q) return true;
                return u.sub_location_name.toLowerCase().includes(q) || u.suffix.toLowerCase().includes(q);
            })
            .sort((a, b) => b.timesheet_hours - a.timesheet_hours);
    }, [data, search]);

    const exportCSV = () => {
        if (!data || !data.rows.length) return;
        const csv = Papa.unparse(
            data.rows.map((r) => ({
                Area: r.area,
                'DPC Code': r.dpc_key,
                'Cost Code': r.cost_code,
                Description: r.description,
                Matched: r.matched ? 'Yes' : 'No',
                'Timesheet Sub-Locations': r.matched_sub_locations.map((s) => s.name).join('; '),
                'DPC Hours': r.dpc_hours,
                'Timesheet Hours': r.timesheet_hours,
                Variance: r.variance,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const locName = availableLocations.find((l) => String(l.id) === locationId)?.name ?? 'project';
        a.download = `timesheet-vs-dpc-${locName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
    };

    const dateLabel = date?.from
        ? date.to
            ? `${format(date.from, 'd/MM/yyyy')} – ${format(date.to, 'd/MM/yyyy')}`
            : format(date.from, 'd/MM/yyyy')
        : 'All time';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheet vs DPC" />
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-64 flex-1">
                        <Select value={locationId} onValueChange={setLocationId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLocations.map((l) => (
                                    <SelectItem key={l.id} value={String(l.id)}>
                                        {l.name}
                                        {l.external_id ? ` (${l.external_id})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateLabel}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="range"
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2}
                            />
                            {date && (
                                <div className="border-t p-2">
                                    <Button variant="ghost" size="sm" onClick={() => setDate(undefined)} className="w-full">
                                        Clear dates
                                    </Button>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                    <Select value={uploadId} onValueChange={setUploadId} disabled={!data?.uploads?.length}>
                        <SelectTrigger className="w-auto min-w-40">
                            <SelectValue placeholder="Latest DPC" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="latest">Latest DPC</SelectItem>
                            {data?.uploads?.map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                    {u.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={fetchData} disabled={loading || !locationId}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Run
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" disabled={!data?.rows?.length} title="Download">
                                <Download className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={exportCSV}>Download as CSV</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && hasSearched && data && data.message && (
                    <p className="py-12 text-center text-sm text-muted-foreground">{data.message}</p>
                )}

                {!loading && data && data.rows.length > 0 && (
                    <>
                        {/* Top totals */}
                        <Card>
                            <CardContent className="py-5">
                                <div className="grid grid-cols-3 gap-4 sm:gap-8">
                                    <Stat label="Total timesheet hours" value={data.totals.timesheet_hours} />
                                    <Stat label="Total DPC used hours" value={data.totals.dpc_hours} />
                                    <Stat
                                        label="Variance"
                                        value={data.totals.variance}
                                        signed
                                        toned
                                        pct={data.totals.variance_pct}
                                    />
                                </div>
                                {data.selected_upload?.report_date_formatted && (
                                    <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
                                        DPC as of <span className="font-medium text-foreground">{data.selected_upload.report_date_formatted}</span>
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Search */}
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search code, description, sub-location…"
                            className="h-9 w-full max-w-sm"
                        />

                        {/* 1. Matched codes */}
                        <Section
                            title="Matched codes"
                            count={matchedRows.length}
                            empty="No DPC codes are matched to a sub-location with hours."
                        >
                            {matchedRows.length > 0 && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                DPC code
                                            </TableHead>
                                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Timesheet sub-location
                                            </TableHead>
                                            <TableHead className="w-24 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                DPC hrs
                                            </TableHead>
                                            <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Timesheet hrs
                                            </TableHead>
                                            <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Variance
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {matchedRows.map((r) => (
                                            <TableRow key={r.dpc_key}>
                                                <TableCell className="py-2 align-top">
                                                    <div className="font-mono text-xs">{r.dpc_key}</div>
                                                    <div className="text-xs text-muted-foreground">{r.description}</div>
                                                </TableCell>
                                                <TableCell className="py-2 align-top text-sm">
                                                    {r.matched_sub_locations.map((s) => s.name).join(', ')}
                                                </TableCell>
                                                <TableCell className="py-2 text-right align-top text-sm tabular-nums">
                                                    {fmt(r.dpc_hours)}
                                                </TableCell>
                                                <TableCell className="py-2 text-right align-top text-sm tabular-nums">
                                                    {fmt(r.timesheet_hours)}
                                                </TableCell>
                                                <TableCell className={`py-2 text-right align-top text-sm tabular-nums ${tone(r.variance)}`}>
                                                    {fmtSigned(r.variance)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Section>

                        {/* 2. DPC codes — unallocated */}
                        <Section
                            title="DPC codes — no matching sub-location"
                            count={unmatchedDpcRows.length}
                            totalLabel="DPC hrs"
                            total={unmatchedDpcRows.reduce((a, r) => a + r.dpc_hours, 0)}
                            description="DPC codes whose area-cost_code suffix isn't found on any sub-location's external_id."
                            empty="Every DPC code with hours has a matching sub-location."
                        >
                            {unmatchedDpcRows.length > 0 && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                DPC code
                                            </TableHead>
                                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Description
                                            </TableHead>
                                            <TableHead className="w-24 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                DPC hrs
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unmatchedDpcRows.map((r) => (
                                            <TableRow key={r.dpc_key}>
                                                <TableCell className="py-2 font-mono text-xs">{r.dpc_key}</TableCell>
                                                <TableCell className="py-2 text-sm">{r.description}</TableCell>
                                                <TableCell className="py-2 text-right text-sm tabular-nums">{fmt(r.dpc_hours)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Section>

                        {/* 3. Timesheet — unallocated */}
                        <Section
                            title="Timesheet — no matching DPC code"
                            count={unmatchedTsRows.length + (data.parent_hours > 0 ? 1 : 0)}
                            totalLabel="Timesheet hrs"
                            total={unmatchedTsRows.reduce((a, r) => a + r.timesheet_hours, 0) + data.parent_hours}
                            description="Timesheet hours that can't be tied to a DPC cost code."
                            empty="All timesheet hours are allocated to a DPC code."
                        >
                            {(unmatchedTsRows.length > 0 || data.parent_hours > 0) && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Sub-location / source
                                            </TableHead>
                                            <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                External ID suffix
                                            </TableHead>
                                            <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Timesheet hrs
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unmatchedTsRows.map((u) => (
                                            <TableRow key={u.sub_location_id}>
                                                <TableCell className="py-2 text-sm">{u.sub_location_name}</TableCell>
                                                <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">{u.suffix}</TableCell>
                                                <TableCell className="py-2 text-right text-sm tabular-nums">{fmt(u.timesheet_hours)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {data.parent_hours > 0 && (
                                            <TableRow>
                                                <TableCell className="py-2 text-sm">
                                                    Parent project (productive worktypes)
                                                    <div className="text-[11px] text-muted-foreground">
                                                        Wages, Foreman, Leading Hands, Labourers — clocked at the project level
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2 text-[11px] text-muted-foreground">—</TableCell>
                                                <TableCell className="py-2 text-right text-sm tabular-nums">{fmt(data.parent_hours)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </Section>
                    </>
                )}

                {!loading && hasSearched && data && data.rows.length === 0 && !data.message && (
                    <p className="py-12 text-center text-sm text-muted-foreground">No DPC cost codes found in the selected upload.</p>
                )}
            </div>
        </AppLayout>
    );
}

function Stat({
    label,
    value,
    signed,
    toned,
    pct,
}: {
    label: string;
    value: number;
    signed?: boolean;
    toned?: boolean;
    pct?: number | null;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            <div className={`flex items-baseline gap-2 ${toned ? tone(value) : ''}`}>
                <span className="text-3xl font-semibold tabular-nums">{signed ? fmtSigned(value) : fmt(value)}</span>
                {pct !== undefined && pct !== null && (
                    <span className="text-sm font-normal">
                        {pct > 0 ? '+' : ''}
                        {pct}%
                    </span>
                )}
            </div>
        </div>
    );
}

function Section({
    title,
    count,
    total,
    totalLabel,
    description,
    empty,
    children,
}: {
    title: string;
    count: number;
    total?: number;
    totalLabel?: string;
    description?: string;
    empty: string;
    children?: React.ReactNode;
}) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
                    <div>
                        <h2 className="text-sm font-semibold">
                            {title} <span className="ml-1 font-normal text-muted-foreground">({count})</span>
                        </h2>
                        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
                    </div>
                    {total !== undefined && (
                        <span className="text-sm tabular-nums text-muted-foreground">
                            {totalLabel}: <span className="font-semibold text-foreground">{fmt(total)}</span>
                        </span>
                    )}
                </div>
                {count === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p> : children}
            </CardContent>
        </Card>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/' },
    { title: 'Missing Sign-Out Report', href: '/reports/missing-sign-out' },
];

type KioskOption = { eh_kiosk_id: string; name: string; location_name: string };
type EmployeeOption = { eh_employee_id: string; name: string };

type Record = {
    id: number;
    employee_name: string;
    employee_id: string;
    clock_in: string;
    clock_in_date: string;
    clock_in_time: string;
    kiosk_name: string;
    eh_kiosk_id: string;
    location_name: string;
};

type GroupBy = 'location' | 'date' | 'employee' | 'kiosk';
type SortBy = 'name-asc' | 'name-desc' | 'count-desc' | 'count-asc';
type Group = { key: string; label: string; count: number; records: Record[] };

const groupByOptions: { value: GroupBy; label: string }[] = [
    { value: 'location', label: 'Project / Location' },
    { value: 'date', label: 'Date' },
    { value: 'employee', label: 'Employee' },
    { value: 'kiosk', label: 'Kiosk' },
];

const sortByOptions: { value: SortBy; label: string }[] = [
    { value: 'count-desc', label: 'Most missing first' },
    { value: 'count-asc', label: 'Least missing first' },
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
];

const groupByField: { [K in GroupBy]: keyof Record } = {
    location: 'location_name',
    date: 'clock_in_date',
    employee: 'employee_name',
    kiosk: 'kiosk_name',
};

function formatDateStr(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function buildGroups(records: Record[], gb: GroupBy, sort: SortBy): Group[] {
    const map = new Map<string, Record[]>();
    const field = groupByField[gb];
    for (const r of records) {
        const k = String(r[field]);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
    }
    const groups: Group[] = Array.from(map.entries()).map(([k, recs]) => ({
        key: k,
        label: gb === 'date' ? formatDateStr(k) : k,
        count: recs.length,
        records: recs,
    }));
    switch (sort) {
        case 'count-desc':
            groups.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
            break;
        case 'count-asc':
            groups.sort((a, b) => a.count - b.count || a.label.localeCompare(b.label));
            break;
        case 'name-asc':
            groups.sort((a, b) => (gb === 'date' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
            break;
        case 'name-desc':
            groups.sort((a, b) => (gb === 'date' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)));
            break;
    }
    return groups;
}

type Column = { key: keyof Record; label: string; width: string };

function getColumns(gb: GroupBy): Column[] {
    const cols: Column[] = [];
    if (gb !== 'date') cols.push({ key: 'clock_in_date', label: 'Date', width: '25%' });
    if (gb !== 'employee') cols.push({ key: 'employee_name', label: 'Employee', width: '25%' });
    cols.push({ key: 'employee_id', label: 'Employee ID', width: '15%' });
    cols.push({ key: 'clock_in_time', label: 'Clock-In', width: '15%' });
    if (gb !== 'kiosk') cols.push({ key: 'kiosk_name', label: 'Kiosk', width: '20%' });
    if (gb !== 'location') cols.push({ key: 'location_name', label: 'Location', width: '20%' });
    return cols;
}

function formatCellValue(col: Column, r: Record) {
    return col.key === 'clock_in_date' ? formatDateStr(r.clock_in_date) : r[col.key];
}

export default function MissingSignOutReport() {
    const { kiosks, employees } = usePage<{ kiosks: KioskOption[]; employees: EmployeeOption[] }>().props;

    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [selectedKiosk, setSelectedKiosk] = useState<string>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [groupBy, setGroupBy] = useState<GroupBy>('date');
    const [sortBy, setSortBy] = useState<SortBy>('count-desc');
    const [records, setRecords] = useState<Record[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

    const groups = useMemo(() => {
        const g = buildGroups(records, groupBy, sortBy);
        setOpenGroups(new Set(g.map((x) => x.key)));
        return g;
    }, [records, groupBy, sortBy]);

    const columns = useMemo(() => getColumns(groupBy), [groupBy]);

    const toggleGroup = (key: string) =>
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    const fetchData = async () => {
        setLoading(true);
        setHasSearched(true);
        const params = new URLSearchParams();
        if (date?.from) params.set('date_from', format(date.from, 'yyyy-MM-dd'));
        if (date?.to) params.set('date_to', format(date.to, 'yyyy-MM-dd'));
        if (selectedKiosk !== 'all') params.set('eh_kiosk_id', selectedKiosk);
        if (selectedEmployee !== 'all') params.set('eh_employee_id', selectedEmployee);
        try {
            const res = await fetch(`/reports/missing-sign-out/data?${params}`);
            const data = await res.json();
            if (data.success) {
                setRecords(data.records);
                setTotalCount(data.total_count);
            }
        } catch {
            setRecords([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        if (!records.length) return;
        const csv = Papa.unparse(
            records.map((r) => ({
                'Employee Name': r.employee_name,
                'Employee ID': r.employee_id,
                Date: r.clock_in_date,
                'Clock In Time': r.clock_in_time,
                Kiosk: r.kiosk_name,
                'Project / Location': r.location_name,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `missing-sign-out-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
    };

    const dateLabel = date?.from
        ? date.to
            ? `${format(date.from, 'd/MM/yyyy')} - ${format(date.to, 'd/MM/yyyy')}`
            : format(date.from, 'd/MM/yyyy')
        : 'All dates';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Missing Sign-Out Report" />
            <div className="flex flex-col gap-2 p-4">
                <h1 className="text-2xl font-semibold">Missing Sign-Out Report</h1>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Date range</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="justify-start font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateLabel}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="range" selected={date} onSelect={setDate} numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2} />
                                        {date && (
                                            <div className="border-t p-2">
                                                <Button variant="ghost" size="sm" onClick={() => setDate(undefined)} className="w-full">
                                                    Clear dates
                                                </Button>
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Kiosk</label>
                                <Select value={selectedKiosk} onValueChange={setSelectedKiosk}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {kiosks.map((k) => (
                                            <SelectItem key={k.eh_kiosk_id} value={String(k.eh_kiosk_id)}>
                                                {k.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Employee</label>
                                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {employees.map((e) => (
                                            <SelectItem key={e.eh_employee_id} value={e.eh_employee_id}>
                                                {e.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Group by</label>
                                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groupByOptions.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Sort by</label>
                                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sortByOptions.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm text-muted-foreground">
                                {hasSearched && (
                                    <>
                                        Total missing sign-outs: <strong>{totalCount}</strong>
                                    </>
                                )}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button onClick={fetchData} disabled={loading} className="flex-1 sm:flex-none">
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Run report
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" disabled={!records.length} className="flex-1 sm:flex-none">
                                            <Download className="mr-2 h-4 w-4" />
                                            Download
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={exportCSV}>Download as CSV</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && groups.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setOpenGroups(new Set(groups.map((g) => g.key)))}>
                            Expand all
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setOpenGroups(new Set())}>
                            Collapse all
                        </Button>
                    </div>
                )}

                {!loading && hasSearched && groups.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">No missing sign-outs found for the selected filters.</CardContent>
                    </Card>
                )}

                {!loading &&
                    groups.map((group) => (
                        <Collapsible key={group.key} open={openGroups.has(group.key)} onOpenChange={() => toggleGroup(group.key)}>
                            <Card className="gap-0 overflow-hidden py-0">
                                <CollapsibleTrigger asChild>
                                    <button className="group flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/50">
                                        {openGroups.has(group.key) ? (
                                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        )}
                                        <span className="text-sm font-semibold">{group.label}</span>
                                        <Badge variant="secondary" className="ml-auto tabular-nums">
                                            {group.count}
                                        </Badge>
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    {/* Desktop table */}
                                    <div className="hidden border-t md:block">
                                        <Table className="table-fixed">
                                            <colgroup>
                                                {columns.map((col) => (
                                                    <col key={col.key} style={{ width: col.width }} />
                                                ))}
                                            </colgroup>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    {columns.map((col) => (
                                                        <TableHead key={col.key} className="h-8 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            {col.label}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.records.map((r) => (
                                                    <TableRow key={r.id}>
                                                        {columns.map((col) => (
                                                            <TableCell key={col.key} className="px-3 py-1.5 text-sm">
                                                                {formatCellValue(col, r)}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {/* Mobile stacked cards */}
                                    <div className="divide-y border-t md:hidden">
                                        {group.records.map((r) => (
                                            <div key={r.id} className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2">
                                                {columns.map((col) => (
                                                    <div key={col.key} className="flex flex-col">
                                                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{col.label}</span>
                                                        <span className="text-sm">{formatCellValue(col, r)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    ))}
            </div>
        </AppLayout>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerDemo } from '@/components/date-picker';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { format, parse } from 'date-fns';
import { ArrowUpDown, ChevronsLeft, ChevronsRight, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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

interface PaginatedRows {
    data: TimesheetRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Totals {
    hours: number;
    nt: number;
    ot: number;
    employees: number;
}

type SortKey = 'date' | 'employee_name' | 'hours' | 'worktype_name' | 'location_name';
type SortDir = 'asc' | 'desc';

interface Filters {
    search: string | null;
    per_page: number;
    sort_key: SortKey;
    sort_dir: SortDir;
}

interface ProjectOption {
    id: number;
    name: string;
}

interface TimesheetsPageProps {
    rows: PaginatedRows;
    totals: Totals;
    category: Category;
    date_from: string;
    date_to: string;
    project_names: string[];
    project_ids: number[];
    available_projects: ProjectOption[];
    truncated: boolean;
    filters: Filters;
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

const formatHours = (value: number) => {
    if (!value) return '-';
    return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function getPageWindow(current: number, last: number): (number | 'ellipsis')[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const around = [current - 1, current, current + 1].filter((p) => p > 1 && p < last);
    const pages: (number | 'ellipsis')[] = [1];
    if (around[0] > 2) pages.push('ellipsis');
    pages.push(...around);
    if (around[around.length - 1] < last - 1) pages.push('ellipsis');
    pages.push(last);
    return pages;
}

export default function Timesheets({
    rows,
    totals,
    category,
    date_from,
    date_to,
    project_ids,
    available_projects,
    truncated,
    filters,
}: TimesheetsPageProps) {
    const showNtOt = category === 'nt' || category === 'ot' || category === 'worked';
    const backUrl = `/labour-dashboard?projects=${project_ids.join(',')}&from=${date_from}&to=${date_to}`;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Labour Dashboard', href: backUrl },
        { title: CATEGORY_LABELS[category], href: '#' },
    ];

    const navigate = (params: Record<string, string | number | undefined | null>) => {
        const query: Record<string, string | number | undefined> = {
            location_ids: project_ids.join(','),
            date_from,
            date_to,
            category,
            search: filters.search ?? undefined,
            per_page: filters.per_page,
            sort_key: filters.sort_key,
            sort_dir: filters.sort_dir,
            ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? undefined])),
        };
        router.get('/labour-dashboard/timesheets', query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Debounced search
    const [searchInput, setSearchInput] = useState(filters.search ?? '');
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const id = setTimeout(() => {
            const next = searchInput.trim();
            if (next === (filters.search ?? '')) return;
            navigate({ search: next || undefined, page: 1 });
        }, 300);
        return () => clearTimeout(id);
         
    }, [searchInput]);

    const toggleSort = (key: SortKey) => {
        const sameKey = filters.sort_key === key;
        const nextDir: SortDir = sameKey ? (filters.sort_dir === 'asc' ? 'desc' : 'asc') : 'asc';
        navigate({ sort_key: key, sort_dir: nextDir, page: 1 });
    };

    const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
        <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-foreground">
            {label}
            <ArrowUpDown className={cn('h-3 w-3 shrink-0', filters.sort_key === k && 'text-foreground')} />
        </button>
    );

    // Filter sheet — local draft state, committed on Apply
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const initialSelectedProjects = useMemo(
        () => available_projects.filter((p) => project_ids.includes(p.id)),
        [available_projects, project_ids],
    );
    const [draftProjects, setDraftProjects] = useState<ProjectOption[]>(initialSelectedProjects);
    const [draftDateFrom, setDraftDateFrom] = useState(date_from);
    const [draftDateTo, setDraftDateTo] = useState(date_to);
    const [draftCategory, setDraftCategory] = useState<Category>(category);

    useEffect(() => {
        if (filterSheetOpen) {
            setDraftProjects(initialSelectedProjects);
            setDraftDateFrom(date_from);
            setDraftDateTo(date_to);
            setDraftCategory(category);
        }
    }, [filterSheetOpen, initialSelectedProjects, date_from, date_to, category]);

    const applyFilterSheet = () => {
        if (draftProjects.length === 0) return;
        setFilterSheetOpen(false);
        router.get(
            '/labour-dashboard/timesheets',
            {
                location_ids: draftProjects.map((p) => p.id).join(','),
                date_from: draftDateFrom,
                date_to: draftDateTo,
                category: draftCategory,
                per_page: filters.per_page,
                sort_key: filters.sort_key,
                sort_dir: filters.sort_dir,
                search: filters.search ?? undefined,
            },
            { preserveScroll: true, preserveState: false },
        );
    };

    const resetFilterSheet = () => {
        setDraftProjects(initialSelectedProjects);
        setDraftDateFrom(date_from);
        setDraftDateTo(date_to);
        setDraftCategory(category);
    };

    const fromRow = rows.total === 0 ? 0 : (rows.current_page - 1) * rows.per_page + 1;
    const toRow = Math.min(rows.current_page * rows.per_page, rows.total);
    const pageWindow = getPageWindow(rows.current_page, rows.last_page);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Timesheets — ${CATEGORY_LABELS[category]}`} />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
                {/* Toolbar: search left, filters right */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Filter employee / work type / location…"
                            className="h-8 pl-7 text-xs"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                            <SheetTrigger
                                render={
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Filters
                                    </Button>
                                }
                            />
                            <SheetContent side="right" className="w-full sm:max-w-sm">
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Category</Label>
                                        <Combobox<Category>
                                            items={Object.keys(CATEGORY_LABELS) as Category[]}
                                            value={draftCategory}
                                            itemToStringLabel={(c) => CATEGORY_LABELS[c]}
                                            itemToStringValue={(c) => c}
                                            isItemEqualToValue={(a, b) => a === b}
                                            onValueChange={(c) => c && setDraftCategory(c)}
                                        >
                                            <ComboboxTrigger
                                                aria-label="Select category"
                                                className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground transition-colors hover:bg-muted aria-expanded:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
                                            >
                                                <ComboboxValue>{CATEGORY_LABELS[draftCategory]}</ComboboxValue>
                                            </ComboboxTrigger>
                                            <ComboboxContent className="min-w-(--anchor-width) p-0">
                                                <ComboboxInput placeholder="Search categories…" className="h-9" showTrigger={false} />
                                                <ComboboxEmpty>No categories found.</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(c: Category) => (
                                                        <ComboboxItem key={c} value={c}>
                                                            {CATEGORY_LABELS[c]}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Projects</Label>
                                        <Combobox<ProjectOption>
                                            items={available_projects}
                                            value={draftProjects}
                                            multiple
                                            itemToStringLabel={(p) => p.name}
                                            itemToStringValue={(p) => String(p.id)}
                                            isItemEqualToValue={(a, b) => a.id === b.id}
                                            onValueChange={(next) => setDraftProjects(next ?? [])}
                                        >
                                            <ComboboxChips>
                                                {draftProjects.map((p) => (
                                                    <ComboboxChip key={p.id} value={p}>
                                                        {p.name}
                                                    </ComboboxChip>
                                                ))}
                                                <ComboboxChipsInput placeholder={draftProjects.length === 0 ? 'Select projects…' : ''} />
                                            </ComboboxChips>
                                            <ComboboxContent className="min-w-(--anchor-width) p-0">
                                                <ComboboxInput placeholder="Search projects…" className="h-9" showTrigger={false} />
                                                <ComboboxEmpty>No projects found.</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(p: ProjectOption) => (
                                                        <ComboboxItem key={p.id} value={p}>
                                                            {p.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                        {draftProjects.length === 0 && (
                                            <p className="text-xs text-destructive">Select at least one project.</p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>From date</Label>
                                        <DatePickerDemo
                                            value={draftDateFrom ? parse(draftDateFrom, 'yyyy-MM-dd', new Date()) : undefined}
                                            onChange={(d) => setDraftDateFrom(d ? format(d, 'yyyy-MM-dd') : '')}
                                            placeholder="From date"
                                            displayFormat="dd/MM/yyyy"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>To date</Label>
                                        <DatePickerDemo
                                            value={draftDateTo ? parse(draftDateTo, 'yyyy-MM-dd', new Date()) : undefined}
                                            onChange={(d) => setDraftDateTo(d ? format(d, 'yyyy-MM-dd') : '')}
                                            placeholder="To date"
                                            displayFormat="dd/MM/yyyy"
                                        />
                                    </div>
                                </div>
                                <SheetFooter>
                                    <Button variant="ghost" onClick={resetFilterSheet}>Reset</Button>
                                    <Button onClick={applyFilterSheet} disabled={draftProjects.length === 0 || !draftDateFrom || !draftDateTo}>
                                        Apply
                                    </Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>
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
                        <TableHeader>
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
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={showNtOt ? 8 : 6} className="py-8 text-center text-muted-foreground">
                                        No timesheets match this drill-through.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.data.map((row) => (
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
                                    </TableRow>
                                ))
                            )}
                            {rows.data.length > 0 && (
                                <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={5}>Total Hours</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatHours(totals.hours)}</TableCell>
                                    {showNtOt && (
                                        <>
                                            <TableCell className="text-right tabular-nums">{formatHours(totals.nt)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatHours(totals.ot)}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-muted-foreground text-xs sm:text-sm">
                        {rows.total > 0 ? `${fromRow}–${toRow} of ${rows.total.toLocaleString()} items` : 'No items'}
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                            <Select
                                value={String(rows.per_page)}
                                onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}
                            >
                                <SelectTrigger size="sm" className="w-[72px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[10, 25, 50, 100].map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Pagination className="mx-0 w-auto justify-end">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationLink
                                        aria-label="Go to first page"
                                        aria-disabled={rows.current_page <= 1}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (rows.current_page > 1) navigate({ page: 1 });
                                        }}
                                        className={rows.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
                                    >
                                        <ChevronsLeft className="h-4 w-4" />
                                    </PaginationLink>
                                </PaginationItem>

                                <PaginationItem>
                                    <PaginationPrevious
                                        aria-disabled={rows.current_page <= 1}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (rows.current_page > 1) navigate({ page: rows.current_page - 1 });
                                        }}
                                        className={rows.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
                                    />
                                </PaginationItem>

                                {pageWindow.map((p, i) =>
                                    p === 'ellipsis' ? (
                                        <PaginationItem key={`e-${i}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    ) : (
                                        <PaginationItem key={p}>
                                            <PaginationLink
                                                isActive={p === rows.current_page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    navigate({ page: p });
                                                }}
                                            >
                                                {p}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ),
                                )}

                                <PaginationItem>
                                    <PaginationNext
                                        aria-disabled={rows.current_page >= rows.last_page}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (rows.current_page < rows.last_page) navigate({ page: rows.current_page + 1 });
                                        }}
                                        className={rows.current_page >= rows.last_page ? 'pointer-events-none opacity-50' : ''}
                                    />
                                </PaginationItem>

                                <PaginationItem>
                                    <PaginationLink
                                        aria-label="Go to last page"
                                        aria-disabled={rows.current_page >= rows.last_page}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (rows.current_page < rows.last_page) navigate({ page: rows.last_page });
                                        }}
                                        className={rows.current_page >= rows.last_page ? 'pointer-events-none opacity-50' : ''}
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </PaginationLink>
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

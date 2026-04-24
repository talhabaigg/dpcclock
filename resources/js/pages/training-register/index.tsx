import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Download, Info, ListFilter, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface KioskOption {
    id: number;
    name: string;
}

interface FileTypeOption {
    id: number;
    name: string;
    categories: string[];
}

interface Row {
    id: number;
    name: string;
    kiosks: { id: number; name: string; job_number: string | null }[];
    files: number[];
    missing_count: number;
}

const MAX_HEADER_CHARS = 15;
const truncateHeader = (s: string) =>
    s.length > MAX_HEADER_CHARS ? s.slice(0, MAX_HEADER_CHARS - 1).trimEnd() + '…' : s;

type SortKey = 'missing_desc' | 'missing_asc' | 'name_asc' | 'name_desc';

interface Filters {
    search: string | null;
    kiosk_ids: number[];
    file_type_ids: number[];
    sort: SortKey;
}

interface Props {
    rows: Row[];
    kiosks: KioskOption[];
    fileTypes: FileTypeOption[];
    visibleFileTypes: { id: number; name: string }[];
    filters: Filters;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Training Register', href: '/training-register' }];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'missing_desc', label: 'Most gaps' },
    { value: 'missing_asc', label: 'Fewest gaps' },
    { value: 'name_asc', label: 'A → Z' },
    { value: 'name_desc', label: 'Z → A' },
];

export default function TrainingRegisterIndex({ rows, kiosks, fileTypes, visibleFileTypes, filters }: Props) {
    const [searchValue, setSearchValue] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedKiosks, setSelectedKiosks] = useState<number[]>(filters.kiosk_ids ?? []);
    const [selectedFileTypes, setSelectedFileTypes] = useState<number[]>(filters.file_type_ids ?? []);
    const [isLoading, setIsLoading] = useState(false);

    // Resync sheet checkboxes when server filters change (e.g. navigation, external URL change)
    useEffect(() => {
        setSelectedKiosks(filters.kiosk_ids ?? []);
        setSelectedFileTypes(filters.file_type_ids ?? []);
    }, [filters.kiosk_ids?.join(','), filters.file_type_ids?.join(',')]);

    // Debounced search
    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            const trimmed = searchValue.trim();
            if (trimmed !== (filters.search ?? '')) {
                applyFilters({ search: trimmed || undefined });
            }
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [searchValue]);

    const applyFilters = (overrides: Record<string, unknown> = {}) => {
        const payload: Record<string, unknown> = {
            search: (overrides.search !== undefined ? overrides.search : filters.search) || undefined,
            kiosk_ids: overrides.kiosk_ids !== undefined ? overrides.kiosk_ids : selectedKiosks,
            file_type_ids: overrides.file_type_ids !== undefined ? overrides.file_type_ids : selectedFileTypes,
            sort: overrides.sort !== undefined ? overrides.sort : filters.sort,
        };
        Object.keys(payload).forEach((k) => {
            if (Array.isArray(payload[k]) && (payload[k] as unknown[]).length === 0) {
                delete payload[k];
            }
            if (payload[k] === undefined) delete payload[k];
        });
        router.get('/training-register', payload as never, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setIsLoading(true),
            onFinish: () => setIsLoading(false),
        });
    };

    // Group file types by category for the filter UI
    const fileTypesByCategory = useMemo(() => {
        const groups: Record<string, FileTypeOption[]> = {};
        for (const ft of fileTypes) {
            const cats = ft.categories.length ? ft.categories : ['Uncategorised'];
            for (const cat of cats) {
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(ft);
            }
        }
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [fileTypes]);

    const visibleKiosksFor = (row: Row) => {
        if (filters.kiosk_ids.length) {
            const allowed = new Set(filters.kiosk_ids);
            return row.kiosks.filter((k) => allowed.has(k.id));
        }
        return row.kiosks;
    };

    const toggleKiosk = (id: number) => {
        setSelectedKiosks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    const toggleFileType = (id: number) => {
        setSelectedFileTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    const toggleCategory = (category: string, types: FileTypeOption[]) => {
        const ids = types.map((t) => t.id);
        const allSelected = ids.every((id) => selectedFileTypes.includes(id));
        setSelectedFileTypes((prev) =>
            allSelected ? prev.filter((x) => !ids.includes(x)) : Array.from(new Set([...prev, ...ids])),
        );
    };

    const clearAll = () => {
        setSelectedKiosks([]);
        setSelectedFileTypes([]);
        setSearchValue('');
        applyFilters({ kiosk_ids: [], file_type_ids: [], search: undefined });
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        filters.kiosk_ids.length +
        filters.file_type_ids.length;

    const exportUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        filters.kiosk_ids.forEach((id) => params.append('kiosk_ids[]', String(id)));
        filters.file_type_ids.forEach((id) => params.append('file_type_ids[]', String(id)));
        if (filters.sort) params.set('sort', filters.sort);
        const qs = params.toString();
        return `/training-register/export${qs ? `?${qs}` : ''}`;
    }, [filters]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Training Register" />
            <TooltipProvider delay={200}>
                <div className="flex flex-1 flex-col gap-4 p-4">
                    {/* Top bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-56">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search workers..."
                                    value={searchValue}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    aria-label="Search workers"
                                    className="pl-9"
                                />
                            </div>

                            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Filters'}
                                >
                                    <ListFilter className="mr-2 size-4" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <Badge variant="secondary" className="ml-2" aria-hidden>{activeFilterCount}</Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                                <SheetHeader className="border-b">
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>

                                <div className="flex-1 space-y-6 overflow-y-auto p-4">
                                    <section>
                                        <div className="mb-2 flex items-baseline justify-between">
                                            <h3 className="text-sm font-semibold">Kiosks</h3>
                                            {selectedKiosks.length > 0 && (
                                                <span className="text-xs text-muted-foreground">{selectedKiosks.length} selected</span>
                                            )}
                                        </div>
                                        <div className="space-y-0.5">
                                            {kiosks.map((k) => (
                                                <label key={k.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                                    <Checkbox
                                                        checked={selectedKiosks.includes(k.id)}
                                                        onCheckedChange={() => toggleKiosk(k.id)}
                                                    />
                                                    <span className="text-sm">{k.name}</span>
                                                </label>
                                            ))}
                                            {!kiosks.length && <p className="px-2 text-sm text-muted-foreground">No kiosks available.</p>}
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-1 flex items-baseline justify-between">
                                            <h3 className="text-sm font-semibold">File Types</h3>
                                            {selectedFileTypes.length > 0 && (
                                                <span className="text-xs text-muted-foreground">{selectedFileTypes.length} selected</span>
                                            )}
                                        </div>
                                        <p className="mb-3 text-xs text-muted-foreground">Narrow which columns appear in the table.</p>
                                        <div className="space-y-4">
                                            {fileTypesByCategory.map(([category, types]) => {
                                                const allSelected = types.every((t) => selectedFileTypes.includes(t.id));
                                                return (
                                                    <div key={category}>
                                                        <div className="mb-1 flex items-center justify-between">
                                                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</span>
                                                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => toggleCategory(category, types)}>
                                                                {allSelected ? 'Clear' : 'Select all'}
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            {types.map((ft) => (
                                                                <label key={`${category}-${ft.id}`} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                                                    <Checkbox
                                                                        checked={selectedFileTypes.includes(ft.id)}
                                                                        onCheckedChange={() => toggleFileType(ft.id)}
                                                                    />
                                                                    <span className="text-sm">{ft.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>

                                <SheetFooter className="flex-row justify-between border-t">
                                    <Button variant="outline" onClick={clearAll} disabled={activeFilterCount === 0}>Clear all</Button>
                                    <Button onClick={() => { applyFilters(); setFiltersOpen(false); }} disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                                        Apply
                                    </Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>

                            <Select value={filters.sort} onValueChange={(v) => applyFilters({ sort: v })}>
                                <SelectTrigger className="w-[130px]" aria-label="Sort workers">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button asChild variant="outline">
                            <a href={exportUrl}>
                                <Download className="mr-2 size-4" />
                                Export
                            </a>
                        </Button>
                    </div>

                    {/* Summary */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                            {rows.length} {rows.length === 1 ? 'worker' : 'workers'} · {visibleFileTypes.length} {visibleFileTypes.length === 1 ? 'file type' : 'file types'}
                        </span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="size-3.5 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                                Valid = uploaded, and expiry is empty or today/later.
                            </TooltipContent>
                        </Tooltip>
                        {isLoading && <Loader2 className="size-4 animate-spin" />}
                    </div>

                    {/* Matrix */}
                    <div className="relative overflow-auto rounded-md border bg-background text-xs">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                                <TableRow>
                                    <TableHead className="sticky left-0 z-20 h-auto min-w-[160px] bg-muted px-2 py-0.5 align-top">Worker</TableHead>
                                    <TableHead className="h-auto min-w-[100px] px-2 py-0.5 align-top">Jobs</TableHead>
                                    {visibleFileTypes.map((ft) => {
                                        const truncated = truncateHeader(ft.name);
                                        const headerCell = (
                                            <TableHead key={ft.id} className="h-auto w-[96px] min-w-[96px] max-w-[96px] whitespace-normal break-words px-1.5 py-0.5 text-left align-top leading-tight">
                                                {truncated}
                                            </TableHead>
                                        );
                                        if (truncated === ft.name) return headerCell;
                                        return (
                                            <Tooltip key={ft.id}>
                                                <TooltipTrigger asChild>{headerCell}</TooltipTrigger>
                                                <TooltipContent side="top">{ft.name}</TooltipContent>
                                            </Tooltip>
                                        );
                                    })}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2 + visibleFileTypes.length} className="h-24 text-center text-muted-foreground">
                                            No workers match the current filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {rows.map((row) => {
                                    const validSet = new Set(row.files);
                                    const hasName = !!row.name?.trim();
                                    return (
                                        <TableRow key={row.id} className="group">
                                            <TableCell className="sticky left-0 z-10 bg-background px-2 py-0.5 font-medium transition-colors group-hover:bg-muted/50">
                                                {hasName ? (
                                                    <Link href={`/employees/${row.id}`} className="text-primary hover:underline">
                                                        {row.name}
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-2 py-0.5">
                                                {(() => {
                                                    const list = visibleKiosksFor(row);
                                                    if (!list.length) return <span className="text-muted-foreground">—</span>;
                                                    const [first, ...rest] = list;
                                                    return (
                                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px] leading-none">{first.job_number || first.name}</Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{first.name}</TooltipContent>
                                                            </Tooltip>
                                                            {rest.length > 0 && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Badge variant="outline" className="h-4 px-1 font-mono text-[10px] leading-none">+{rest.length}</Badge>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="max-w-xs">
                                                                        <div className="flex flex-col gap-0.5 text-xs">
                                                                            {rest.map((k) => (
                                                                                <span key={k.id}>
                                                                                    {k.job_number ? `${k.job_number} — ` : ''}{k.name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </TableCell>
                                            {visibleFileTypes.map((ft) => {
                                                const yes = validSet.has(ft.id);
                                                return (
                                                    <TableCell key={ft.id} className="px-1.5 py-0.5 text-center">
                                                        {yes ? (
                                                            <span className="text-muted-foreground">Yes</span>
                                                        ) : (
                                                            <span className="font-medium text-red-600 dark:text-red-400">No</span>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </TooltipProvider>
        </AppLayout>
    );
}

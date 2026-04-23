import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Download, ListFilter, Search, X } from 'lucide-react';
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
    kiosks: { id: number; name: string }[];
    files: number[];
}

interface Filters {
    search: string | null;
    kiosk_ids: number[];
    file_type_ids: number[];
}

interface Props {
    rows: Row[];
    kiosks: KioskOption[];
    fileTypes: FileTypeOption[];
    filters: Filters;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Training Register', href: '/training-register' }];

export default function TrainingRegisterIndex({ rows, kiosks, fileTypes, filters }: Props) {
    const [searchValue, setSearchValue] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedKiosks, setSelectedKiosks] = useState<number[]>(filters.kiosk_ids ?? []);
    const [selectedFileTypes, setSelectedFileTypes] = useState<number[]>(filters.file_type_ids ?? []);

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
        };
        // Clean empty arrays to keep URLs tidy
        Object.keys(payload).forEach((k) => {
            if (Array.isArray(payload[k]) && (payload[k] as unknown[]).length === 0) {
                delete payload[k];
            }
        });
        router.get('/training-register', payload, { preserveState: true, preserveScroll: true, replace: true });
    };

    const visibleFileTypes = useMemo(() => {
        if (!selectedFileTypes.length) return fileTypes;
        const set = new Set(selectedFileTypes);
        return fileTypes.filter((ft) => set.has(ft.id));
    }, [fileTypes, selectedFileTypes]);

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
        const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
        return entries;
    }, [fileTypes]);

    const kioskNameFor = (row: Row) => {
        if (selectedKiosks.length) {
            const allowed = new Set(selectedKiosks);
            return row.kiosks.filter((k) => allowed.has(k.id)).map((k) => k.name).join(', ');
        }
        return row.kiosks.map((k) => k.name).join(', ');
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
        applyFilters({ kiosk_ids: [], file_type_ids: [] });
    };

    const hasActiveFilters = !!(filters.search || filters.kiosk_ids.length || filters.file_type_ids.length);

    const exportUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        filters.kiosk_ids.forEach((id) => params.append('kiosk_ids[]', String(id)));
        filters.file_type_ids.forEach((id) => params.append('file_type_ids[]', String(id)));
        const qs = params.toString();
        return `/training-register/export${qs ? `?${qs}` : ''}`;
    }, [filters]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Training Register" />

            <div className="flex flex-1 flex-col gap-4 p-4">
                {/* Top bar */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search worker..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline">
                                <ListFilter className="mr-2 size-4" />
                                Filters
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="ml-2">
                                        {(filters.kiosk_ids.length ? 1 : 0) + (filters.file_type_ids.length ? 1 : 0) + (filters.search ? 1 : 0)}
                                    </Badge>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                            <SheetHeader>
                                <SheetTitle>Filters</SheetTitle>
                            </SheetHeader>

                            <div className="mt-4 space-y-6 px-4">
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">Kiosks</Label>
                                    <div className="space-y-2">
                                        {kiosks.map((k) => (
                                            <label key={k.id} className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox
                                                    checked={selectedKiosks.includes(k.id)}
                                                    onCheckedChange={() => toggleKiosk(k.id)}
                                                />
                                                <span className="text-sm">{k.name}</span>
                                            </label>
                                        ))}
                                        {!kiosks.length && <p className="text-sm text-muted-foreground">No kiosks available.</p>}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">File Types (columns)</Label>
                                        {selectedFileTypes.length > 0 && (
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFileTypes([])}>Clear</Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Leave empty to show all columns.</p>
                                    <div className="space-y-4">
                                        {fileTypesByCategory.map(([category, types]) => {
                                            const allSelected = types.every((t) => selectedFileTypes.includes(t.id));
                                            return (
                                                <div key={category} className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</span>
                                                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => toggleCategory(category, types)}>
                                                            {allSelected ? 'Clear' : 'Select all'}
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-1.5 pl-1">
                                                        {types.map((ft) => (
                                                            <label key={`${category}-${ft.id}`} className="flex items-center gap-2 cursor-pointer">
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
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button className="flex-1" onClick={() => { applyFilters(); setFiltersOpen(false); }}>
                                        Apply
                                    </Button>
                                    <Button variant="outline" onClick={clearAll}>Clear all</Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearAll}>
                            <X className="mr-1 size-4" /> Clear
                        </Button>
                    )}

                    <div className="ml-auto">
                        <Button asChild variant="outline">
                            <a href={exportUrl}>
                                <Download className="mr-2 size-4" />
                                Download Excel
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <div className="text-sm text-muted-foreground">
                    Showing {rows.length} worker{rows.length === 1 ? '' : 's'} across {visibleFileTypes.length} file type{visibleFileTypes.length === 1 ? '' : 's'}.
                </div>

                {/* Matrix */}
                <div className="relative overflow-auto rounded-md border bg-background">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                            <TableRow>
                                <TableHead className="sticky left-0 z-20 min-w-[180px] bg-muted/60 backdrop-blur">Worker</TableHead>
                                <TableHead className="min-w-[200px]">Kiosk</TableHead>
                                {visibleFileTypes.map((ft) => (
                                    <TableHead key={ft.id} className="min-w-[120px] whitespace-nowrap text-center">{ft.name}</TableHead>
                                ))}
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
                                return (
                                    <TableRow key={row.id}>
                                        <TableCell className="sticky left-0 z-10 bg-background font-medium">{row.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{kioskNameFor(row) || '—'}</TableCell>
                                        {visibleFileTypes.map((ft) => {
                                            const yes = validSet.has(ft.id);
                                            return (
                                                <TableCell key={ft.id} className="text-center">
                                                    <Badge
                                                        variant={yes ? 'default' : 'outline'}
                                                        className={yes
                                                            ? 'bg-green-600 text-white hover:bg-green-600'
                                                            : 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-400'}
                                                    >
                                                        {yes ? 'Yes' : 'No'}
                                                    </Badge>
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
        </AppLayout>
    );
}

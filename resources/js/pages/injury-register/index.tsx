import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryEmployee, InjuryFilters, InjuryLocation } from '@/types/injury';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Download, Loader2, Lock, MoreHorizontal, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Injury Register', href: '/injury-register' }];

interface PaginatedInjuries {
    data: Injury[];
    current_page: number;
    last_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    injuries: PaginatedInjuries;
    filters: InjuryFilters;
    locations: InjuryLocation[];
    employees: InjuryEmployee[];
    incidentOptions: Record<string, string>;
    reportTypeOptions: Record<string, string>;
    isLocal: boolean;
}

export default function InjuryRegisterIndex({ injuries, filters, locations, incidentOptions, reportTypeOptions, isLocal }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string; error?: string }; auth: { permissions?: string[] } }>().props as { flash: { success?: string; error?: string }; auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [locationOpen, setLocationOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const [importFlash, setImportFlash] = useState<{ success?: string; error?: string }>({});
    const importFileRef = useRef<HTMLInputElement>(null);
    const [searchValue, setSearchValue] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            const trimmed = searchValue.trim();
            if (trimmed !== (filters.search ?? '')) {
                setFilter('search', trimmed || undefined);
            }
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [searchValue]);

    const [classifyInjury, setClassifyInjury] = useState<Injury | null>(null);
    const [classForm, setClassForm] = useState({ work_cover_claim: false, work_days_missed: 0, report_type: '' });
    const [classSaving, setClassSaving] = useState(false);

    const openClassifyDialog = (injury: Injury) => {
        setClassForm({
            work_cover_claim: injury.work_cover_claim,
            work_days_missed: injury.work_days_missed,
            report_type: injury.report_type ?? '',
        });
        setClassifyInjury(injury);
    };

    const submitClassification = () => {
        if (!classifyInjury) return;
        setClassSaving(true);
        router.put(`/injury-register/${classifyInjury.id}/classification`, classForm, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setClassSaving(false);
                setClassifyInjury(null);
            },
        });
    };

    const handleImport = async () => {
        const file = importFileRef.current?.files?.[0];
        if (!file) {
            setImportFlash({ error: 'Please select a file first' });
            return;
        }
        setImporting(true);
        setImportResult(null);
        setImportFlash({});
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/injury-register/import', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setImportFlash({ success: `Imported ${data.imported} records` + (data.skipped > 0 ? `, ${data.skipped} skipped` : '') });
                setImportResult({ imported: data.imported, skipped: data.skipped, errors: data.errors || [] });
                if (data.imported > 0) {
                    router.reload({ only: ['injuries'] });
                }
            } else {
                setImportFlash({ error: 'Import failed' });
            }
        } catch {
            setImportFlash({ error: 'Import failed — network error' });
        } finally {
            setImporting(false);
            if (importFileRef.current) importFileRef.current.value = '';
        }
    };

    const setFilter = (key: string, value: string | undefined) => {
        router.get(
            '/injury-register',
            { ...filters, [key]: value === 'all' ? undefined : value, page: undefined },
            { preserveState: true, preserveScroll: true },
        );
    };

    const resetFilters = () => {
        setSearchValue('');
        router.get('/injury-register', {}, { preserveState: true });
    };

    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Injury Register" />

            {flash?.success && <SuccessAlertFlash message={flash.success} />}
            {flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

            <div className="space-y-4 p-4">
                {/* Filters + Report Button */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search worker, location, incident..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="w-64 pl-9"
                        />
                        {searchValue && (
                            <button
                                onClick={() => setSearchValue('')}
                                className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={locationOpen} className="w-48 justify-between font-normal">
                                <span className="truncate">
                                    {filters.location_id
                                        ? locations.find((l) => String(l.id) === filters.location_id)?.name ?? 'All Locations'
                                        : 'All Locations'}
                                </span>
                                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search locations..." />
                                <CommandList>
                                    <CommandEmpty>No location found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => { setFilter('location_id', 'all'); setLocationOpen(false); }}
                                        >
                                            <Check className={`mr-2 h-3.5 w-3.5 ${!filters.location_id ? 'opacity-100' : 'opacity-0'}`} />
                                            All Locations
                                        </CommandItem>
                                        {locations.map((loc) => (
                                            <CommandItem
                                                key={loc.id}
                                                onSelect={() => { setFilter('location_id', String(loc.id)); setLocationOpen(false); }}
                                            >
                                                <Check className={`mr-2 h-3.5 w-3.5 ${filters.location_id === String(loc.id) ? 'opacity-100' : 'opacity-0'}`} />
                                                {loc.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <Select value={filters.incident ?? 'all'} onValueChange={(v) => setFilter('incident', v)}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All Incidents" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Incidents</SelectItem>
                            {Object.entries(incidentOptions).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.report_type ?? 'all'} onValueChange={(v) => setFilter('report_type', v)}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {Object.entries(reportTypeOptions).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="inline-flex items-center rounded-md border text-sm">
                        <span className="text-muted-foreground border-r px-2.5 py-1.5 text-xs font-medium">WorkCover</span>
                        {(['all', '1', '0'] as const).map((val) => (
                            <button
                                key={val}
                                onClick={() => setFilter('work_cover_claim', val)}
                                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                    (filters.work_cover_claim ?? 'all') === val
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted'
                                }`}
                            >
                                {val === 'all' ? 'All' : val === '1' ? 'Yes' : 'No'}
                            </button>
                        ))}
                    </div>

                    <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilter('status', v)}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="locked">Locked</SelectItem>
                        </SelectContent>
                    </Select>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Reset
                        </Button>
                    )}

                    <div className="ml-auto flex gap-2">
                        {can('injury-register.create') && (
                            <Button asChild>
                                <Link href="/injury-register/create">
                                    <Plus className="mr-1 h-4 w-4" />
                                    Report Incident / Injury
                                </Link>
                            </Button>
                        )}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <a href={`/injury-register/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export
                                    </a>
                                </DropdownMenuItem>
                                {can('injury-register.create') && (
                                    <DropdownMenuItem onClick={() => { setImportOpen(true); setImportResult(null); }}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import Legacy
                                    </DropdownMenuItem>
                                )}
                                {isLocal && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-600"
                                            onClick={() => {
                                                if (confirm('Drop ALL injury records? This cannot be undone.')) {
                                                    router.delete('/injury-register/drop-all', { preserveScroll: true });
                                                }
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Drop All
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Filter chips */}
                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {filters.search && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                Search: {filters.search}
                                <button onClick={() => setSearchValue('')} className="hover:bg-muted rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {filters.location_id && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                {locations.find((l) => String(l.id) === filters.location_id)?.name ?? filters.location_id}
                                <button onClick={() => setFilter('location_id', 'all')} className="hover:bg-muted rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {filters.incident && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                {incidentOptions[filters.incident] ?? filters.incident}
                                <button onClick={() => setFilter('incident', 'all')} className="hover:bg-muted rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {filters.report_type && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                {reportTypeOptions[filters.report_type] ?? filters.report_type}
                                <button onClick={() => setFilter('report_type', 'all')} className="hover:bg-muted rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {filters.work_cover_claim && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                WorkCover: {filters.work_cover_claim === '1' ? 'Yes' : 'No'}
                                <button onClick={() => setFilter('work_cover_claim', 'all')} className="hover:bg-muted rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {filters.status && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                {filters.status === 'active' ? 'Active' : 'Locked'}
                                <button onClick={() => setFilter('status', 'all')} className="hover:bg-muted rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                    </div>
                )}

                {/* Table */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Occurred</TableHead>
                                <TableHead>Worker</TableHead>
                                <TableHead>Project / Location</TableHead>
                                <TableHead>Incident</TableHead>
                                <TableHead>WorkCover</TableHead>
                                <TableHead>Days Lost</TableHead>
                                <TableHead>Report Type</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {injuries.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                                        No injury records found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {injuries.data.map((injury) => (
                                <TableRow key={injury.id}>
                                    <TableCell>
                                        <Link href={`/injury-register/${injury.id}`} className="hover:underline">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {injury.id_formal}
                                                {injury.locked_at && <Lock className="ml-1 inline h-3 w-3" />}
                                            </Badge>
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {injury.occurred_at ? new Date(injury.occurred_at.replace(/Z$|[+-]\d{2}:\d{2}$/, '')).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium">{injury.employee?.preferred_name ?? injury.employee?.name ?? injury.employee_name ?? '—'}</div>
                                        {injury.employee?.employment_type && (
                                            <div className="text-muted-foreground text-xs">{injury.employee.employment_type}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{injury.location?.name ?? '—'}</TableCell>
                                    <TableCell><Badge variant="secondary" className="text-xs">{injury.incident_label}</Badge></TableCell>
                                    <TableCell className="text-sm">{injury.work_cover_claim ? 'Yes' : 'No'}</TableCell>
                                    <TableCell className="text-sm">{injury.work_days_missed}</TableCell>
                                    <TableCell>
                                        <InjuryStatusBadge reportType={injury.report_type} label={injury.report_type_label} />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/injury-register/${injury.id}`}>View</Link>
                                                </DropdownMenuItem>
                                                {can('injury-register.edit') && !injury.locked_at && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/injury-register/${injury.id}/edit`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                {can('injury-register.edit') && (
                                                    <DropdownMenuItem onClick={() => openClassifyDialog(injury)}>
                                                        Work cover / days lost / report type
                                                    </DropdownMenuItem>
                                                )}
                                                {can('injury-register.lock') && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        {!injury.locked_at ? (
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    router.post(`/injury-register/${injury.id}/lock`, {}, { preserveScroll: true })
                                                                }
                                                            >
                                                                Lock
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    router.post(`/injury-register/${injury.id}/unlock`, {}, { preserveScroll: true })
                                                                }
                                                            >
                                                                Unlock
                                                            </DropdownMenuItem>
                                                        )}
                                                    </>
                                                )}
                                                {can('injury-register.delete') && !injury.locked_at && (
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() =>
                                                            router.delete(`/injury-register/${injury.id}`, { preserveScroll: true })
                                                        }
                                                    >
                                                        Delete
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {injuries.last_page > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-sm">
                            Page <span className="font-medium">{injuries.current_page}</span> of{' '}
                            <span className="font-medium">{injuries.last_page}</span> ({injuries.total} records)
                        </p>
                        <Pagination>
                            <PaginationContent className="gap-1">
                                <PaginationItem>
                                    <PaginationPrevious href={injuries.prev_page_url ?? undefined} />
                                </PaginationItem>
                                {(() => {
                                    const current = injuries.current_page;
                                    const last = injuries.last_page;
                                    const start = Math.max(1, current - 1);
                                    const end = Math.min(last, current + 1);
                                    const pages = [];
                                    for (let page = start; page <= end; page++) {
                                        const url = injuries.links.find((l) => l.label === String(page))?.url || `?page=${page}`;
                                        pages.push(
                                            <PaginationItem key={page}>
                                                <PaginationLink href={url} isActive={current === page}>
                                                    {page}
                                                </PaginationLink>
                                            </PaginationItem>,
                                        );
                                    }
                                    return pages;
                                })()}
                                <PaginationItem>
                                    <PaginationNext href={injuries.next_page_url ?? undefined} />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </div>

            {/* Import Legacy Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Import Legacy Injury Records</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {importFlash.success && <SuccessAlertFlash message={importFlash.success} />}
                        {importFlash.error && <ErrorAlertFlash error={{ message: importFlash.error }} />}
                        <p className="text-muted-foreground text-sm">
                            Upload an exported Injury Register Excel file (.xlsx). Existing records (matched by ID) will be skipped.
                        </p>
                        <div className="space-y-2">
                            <Label>Excel File (.xlsx)</Label>
                            <Input ref={importFileRef} type="file" accept=".xlsx,.xls" />
                        </div>
                        {importResult && (
                            <div className="space-y-2 rounded-md border p-3">
                                <div className="flex gap-6 text-sm">
                                    <span>Imported: <strong className="text-green-600">{importResult.imported}</strong></span>
                                    <span>Skipped: <strong className="text-yellow-600">{importResult.skipped}</strong></span>
                                </div>
                                {importResult.errors.length > 0 && (
                                    <div>
                                        <p className="text-destructive mb-1 text-sm font-medium">Errors:</p>
                                        <ul className="max-h-40 overflow-y-auto text-sm text-muted-foreground">
                                            {importResult.errors.map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                        <Button onClick={handleImport} disabled={importing}>
                            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            {importing ? 'Importing...' : 'Import'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Classification Dialog */}
            <Dialog open={!!classifyInjury} onOpenChange={(open) => !open && setClassifyInjury(null)}>
                <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Classification — {classifyInjury?.id_formal}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={classForm.work_cover_claim}
                                onCheckedChange={(v) => setClassForm({ ...classForm, work_cover_claim: v })}
                            />
                            <Label>Was a WorkCover claim submitted?</Label>
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Days Lost</Label>
                            <Input
                                type="number"
                                min={0}
                                value={classForm.work_days_missed}
                                onChange={(e) => setClassForm({ ...classForm, work_days_missed: parseInt(e.target.value) || 0 })}
                                className="w-32"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Report Type</Label>
                            <Select value={classForm.report_type} onValueChange={(v) => setClassForm({ ...classForm, report_type: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select report type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(reportTypeOptions).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClassifyInjury(null)}>
                            Cancel
                        </Button>
                        <Button onClick={submitClassification} disabled={classSaving}>
                            {classSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

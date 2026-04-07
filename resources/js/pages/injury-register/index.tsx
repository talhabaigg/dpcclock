import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import AppLayout from '@/layouts/app-layout';
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
import { Head, Link, router } from '@inertiajs/react';
import { ClipboardList, Lock, MoreHorizontal, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';

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
}

export default function InjuryRegisterIndex({ injuries, filters, locations, employees, incidentOptions, reportTypeOptions }: Props) {
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
            onSuccess: () => {
                setClassifyInjury(null);
                setClassSaving(false);
            },
            onError: () => setClassSaving(false),
        });
    };

    const setFilter = (key: string, value: string | undefined) => {
        router.get(
            '/injury-register',
            { ...filters, [key]: value === 'all' ? undefined : value, page: undefined },
            { preserveState: true, preserveScroll: true },
        );
    };

    const resetFilters = () => {
        router.get('/injury-register', {}, { preserveState: true });
    };

    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Injury Register" />

            <div className="space-y-4 p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Injury Register</h1>
                    <Button asChild>
                        <Link href="/injury-register/create">
                            <Plus className="mr-1 h-4 w-4" />
                            Report Incident / Injury
                        </Link>
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={filters.location_id ?? 'all'} onValueChange={(v) => setFilter('location_id', v)}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All Locations" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {locations.map((loc) => (
                                <SelectItem key={loc.id} value={String(loc.id)}>
                                    {loc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

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

                    <Select value={filters.work_cover_claim ?? 'all'} onValueChange={(v) => setFilter('work_cover_claim', v)}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="WorkCover" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">WorkCover: All</SelectItem>
                            <SelectItem value="1">Yes</SelectItem>
                            <SelectItem value="0">No</SelectItem>
                        </SelectContent>
                    </Select>

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
                </div>

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
                                    <TableCell className="font-mono text-sm">
                                        <Link href={`/injury-register/${injury.id}`} className="hover:underline">
                                            {injury.id_formal}
                                            {injury.locked_at && <Lock className="ml-1 inline h-3 w-3 text-amber-500" />}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {injury.occurred_at ? new Date(injury.occurred_at).toLocaleDateString('en-AU') : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium">{injury.employee?.preferred_name ?? injury.employee?.name ?? '—'}</div>
                                        {injury.employee?.employment_type && (
                                            <div className="text-muted-foreground text-xs">{injury.employee.employment_type}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{injury.location?.name ?? '—'}</TableCell>
                                    <TableCell className="text-sm">{injury.incident_label}</TableCell>
                                    <TableCell className="text-sm">{injury.work_cover_claim ? 'Yes' : 'No'}</TableCell>
                                    <TableCell className="text-sm">{injury.work_days_missed}</TableCell>
                                    <TableCell>
                                        <InjuryStatusBadge reportType={injury.report_type} label={injury.report_type_label} />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/injury-register/${injury.id}`}>View</Link>
                                                </DropdownMenuItem>
                                                {!injury.locked_at && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/injury-register/${injury.id}/edit`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => openClassifyDialog(injury)}>
                                                    <ClipboardList className="mr-2 h-4 w-4" />
                                                    Classification
                                                </DropdownMenuItem>
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
                                                {!injury.locked_at && (
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

            {/* Classification Dialog */}
            <Dialog open={!!classifyInjury} onOpenChange={(open) => !open && setClassifyInjury(null)}>
                <DialogContent className="sm:max-w-md">
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

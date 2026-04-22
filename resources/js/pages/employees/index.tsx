import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Filter, RefreshCcw, RotateCcw, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface EmployeeDocument {
    file_type_id: number;
    name: string;
    status: 'valid' | 'expired' | 'expiring_soon';
}

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    email: string;
    pin: string;
    external_id?: string;
    eh_employee_id?: string;
    employment_type?: string;
    worktypes?: { eh_worktype_id: string; name: string }[];
    documents?: EmployeeDocument[];
}

interface FileTypeOption {
    id: number;
    name: string;
    category: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employees', href: '/employees' }];

function SortHeader({ label, column }: { label: string; column: any }) {
    const sorted = column.getIsSorted();
    return (
        <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => column.toggleSorting(sorted === 'asc')}>
            {label}
            {sorted === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="ml-1 h-3 w-3" /> : <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
        </Button>
    );
}

/* ── Licence column header filter ── */
function LicenceFilterHeader({
    fileTypesByCategory,
    selectedIds,
    filterMode,
    onSelectedIdsChange,
    onFilterModeChange,
}: {
    fileTypesByCategory: [string, FileTypeOption[]][];
    selectedIds: Set<number>;
    filterMode: 'has' | 'has_not';
    onSelectedIdsChange: (ids: Set<number>) => void;
    onFilterModeChange: (mode: 'has' | 'has_not') => void;
}) {
    const isActive = selectedIds.size > 0;

    const toggle = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        onSelectedIdsChange(next);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={`-ml-2 h-8 gap-1.5 ${isActive ? 'text-primary' : ''}`}>
                    Licences
                    <Filter className={`h-3 w-3 ${isActive ? 'text-primary' : 'opacity-50'}`} />
                    {isActive && (
                        <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-xs">
                            {selectedIds.size}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                {/* Has / Has not toggle */}
                <div className="flex items-center gap-1 border-b px-3 py-2">
                    <button
                        type="button"
                        className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors ${filterMode === 'has' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => onFilterModeChange('has')}
                    >
                        Has
                    </button>
                    <button
                        type="button"
                        className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors ${filterMode === 'has_not' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => onFilterModeChange('has_not')}
                    >
                        Has not
                    </button>
                </div>

                {/* Scrollable list */}
                <div className="max-h-72 overflow-y-auto p-2">
                    {fileTypesByCategory.map(([category, types]) => (
                        <div key={category} className="mb-2 last:mb-0">
                            <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {category}
                            </p>
                            {types.map((ft) => (
                                <label
                                    key={ft.id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                                >
                                    <Checkbox
                                        checked={selectedIds.has(ft.id)}
                                        onCheckedChange={() => toggle(ft.id)}
                                    />
                                    <span className="truncate">{ft.name}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {isActive && (
                    <div className="flex items-center justify-between border-t px-3 py-2">
                        <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            onClick={() => onSelectedIdsChange(new Set())}
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

export default function EmployeesList() {
    const { employees, fileTypes, flash } = usePage<{
        employees: Employee[];
        fileTypes: FileTypeOption[];
        flash: { success?: string };
    }>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>('all');
    const [licenceFilterIds, setLicenceFilterIds] = useState<Set<number>>(new Set());
    const [licenceFilterMode, setLicenceFilterMode] = useState<'has' | 'has_not'>('has');
    const [open, setOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

    const fileTypesByCategory = useMemo(() => {
        const grouped: Record<string, FileTypeOption[]> = {};
        for (const ft of fileTypes ?? []) {
            const cat = ft.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(ft);
        }
        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [fileTypes]);

    const employmentTypes = useMemo(() => {
        const types = new Set(employees.map((e) => e.employment_type).filter(Boolean));
        return Array.from(types).sort() as string[];
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        let filtered = employees;

        if (employmentTypeFilter !== 'all') {
            filtered = filtered.filter((e) => e.employment_type === employmentTypeFilter);
        }

        if (licenceFilterIds.size > 0) {
            filtered = filtered.filter((e) => {
                const empDocIds = new Set(e.documents?.map((d) => d.file_type_id) ?? []);
                if (licenceFilterMode === 'has') {
                    return [...licenceFilterIds].every((id) => empDocIds.has(id));
                } else {
                    return [...licenceFilterIds].every((id) => !empDocIds.has(id));
                }
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (employee) =>
                    employee.name.toLowerCase().includes(query) ||
                    employee.preferred_name?.toLowerCase().includes(query) ||
                    employee.email?.toLowerCase().includes(query) ||
                    employee.external_id?.toLowerCase().includes(query) ||
                    employee.eh_employee_id?.toLowerCase().includes(query),
            );
        }
        return filtered;
    }, [employees, searchQuery, employmentTypeFilter, licenceFilterIds, licenceFilterMode]);

    const hasActiveFilters = employmentTypeFilter !== 'all' || licenceFilterIds.size > 0 || searchQuery !== '';

    const columns: ColumnDef<Employee>[] = useMemo(
        () => [
            {
                accessorKey: 'name',
                header: ({ column }) => <SortHeader label="Employee" column={column} />,
                cell: ({ row }) => (
                    <Link href={`/employees/${row.original.id}`} className="flex items-center gap-2">
                        <UserInfo
                            user={{
                                ...row.original,
                                email_verified_at: '',
                                created_at: '',
                                updated_at: '',
                                phone: '',
                            }}
                        />
                        {row.original.preferred_name && (
                            <span className="text-xs text-muted-foreground">({row.original.preferred_name})</span>
                        )}
                    </Link>
                ),
            },
            {
                accessorKey: 'email',
                header: ({ column }) => <SortHeader label="Email" column={column} />,
                cell: ({ row }) => {
                    const val = row.original.email;
                    return val ? (
                        <a href={`mailto:${val.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">{val.toLowerCase()}</a>
                    ) : (
                        <span className="text-sm italic text-muted-foreground">—</span>
                    );
                },
            },
            {
                accessorKey: 'employment_type',
                header: ({ column }) => <SortHeader label="Type" column={column} />,
                cell: ({ row }) => {
                    const val = row.original.employment_type;
                    if (!val) return <span className="text-sm italic text-muted-foreground">N/A</span>;
                    const variant = val === 'FullTime' ? 'default' : val === 'Casual' ? 'outline' : 'secondary';
                    const label = val.replace(/([A-Z])/g, ' $1').trim();
                    return <Badge variant={variant} className="text-xs">{label}</Badge>;
                },
            },
            {
                id: 'worktypes',
                header: 'Work Types',
                cell: ({ row }) => {
                    const worktypes = row.original.worktypes;
                    if (!worktypes || worktypes.length === 0) {
                        return <span className="text-sm italic text-muted-foreground">None</span>;
                    }
                    return (
                        <div className="flex flex-wrap items-center gap-1">
                            {worktypes.slice(0, 2).map((wt) => (
                                <Badge key={wt.eh_worktype_id} variant="secondary" className="text-xs">
                                    {wt.name}
                                </Badge>
                            ))}
                            {worktypes.length > 2 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="outline" className="cursor-pointer text-xs text-muted-foreground hover:bg-muted">
                                                +{worktypes.length - 2}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-xs p-3">
                                            <p className="mb-2 text-xs font-medium">All Work Types</p>
                                            <div className="flex flex-wrap gap-1">
                                                {worktypes.map((wt) => (
                                                    <Badge key={wt.eh_worktype_id} variant="secondary" className="text-xs">
                                                        {wt.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    );
                },
            },
            {
                id: 'documents',
                header: 'Licences',
                cell: ({ row }) => {
                    const docs = row.original.documents;
                    if (!docs || docs.length === 0) {
                        return <span className="text-sm italic text-muted-foreground">None</span>;
                    }
                    return (
                        <div className="flex max-w-xs flex-wrap gap-1">
                            {docs.map((d) => (
                                <Badge
                                    key={d.file_type_id}
                                    variant={d.status === 'expired' ? 'destructive' : 'outline'}
                                    className={`text-xs ${d.status === 'expiring_soon' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' : ''}`}
                                >
                                    {d.name}
                                </Badge>
                            ))}
                        </div>
                    );
                },
            },
            {
                id: 'actions',
                cell: ({ row }) => (
                    <div className="text-right">
                        <Link href={`/employee/${row.original.id}/worktypes/sync`}>
                            <Button variant="outline" size="sm" className="gap-2 opacity-0 transition-all group-hover:opacity-100">
                                <RotateCcw className="h-3.5 w-3.5" />
                                Retry Sync
                            </Button>
                        </Link>
                    </div>
                ),
            },
        ],
        [],
    );

    const table = useReactTable({
        data: filteredEmployees,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const clearFilters = () => {
        setSearchQuery('');
        setEmploymentTypeFilter('all');
        setLicenceFilterIds(new Set());
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {flash.success && (
                    <Alert className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertTitle className="text-emerald-700 dark:text-emerald-400">Success</AlertTitle>
                        <AlertDescription className="text-emerald-600 dark:text-emerald-300">{flash.success}</AlertDescription>
                    </Alert>
                )}

                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                            <SelectTrigger className="h-9 w-[140px] text-sm">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {employmentTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type.replace(/([A-Z])/g, ' $1').trim()}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        )}

                        <Link href="/employees/sync" method="get">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                <RefreshCcw className="h-4 w-4" />
                                Sync
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Active licence filter chips */}
                {licenceFilterIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            {licenceFilterMode === 'has' ? 'Has:' : 'Missing:'}
                        </span>
                        {[...licenceFilterIds].map((id) => {
                            const ft = (fileTypes ?? []).find((f) => f.id === id);
                            return (
                                <Badge key={id} variant="secondary" className="gap-1 pr-1 text-xs">
                                    {ft?.name ?? `#${id}`}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${ft?.name ?? ''} filter`}
                                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                                        onClick={() => {
                                            const next = new Set(licenceFilterIds);
                                            next.delete(id);
                                            setLicenceFilterIds(next);
                                        }}
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </Badge>
                            );
                        })}
                        <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            onClick={() => setLicenceFilterIds(new Set())}
                        >
                            Clear all
                        </button>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    Showing {filteredEmployees.length} of {employees.length} employees
                </p>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredEmployees.length ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            {searchQuery ? `No employees match "${searchQuery}"` : 'No employees found.'}
                        </div>
                    ) : (
                        filteredEmployees.map((emp) => (
                            <Link key={emp.id} href={`/employees/${emp.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                    <UserInfo
                                        user={{ ...emp, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}
                                        showEmail
                                    />
                                </div>
                                {emp.documents && emp.documents.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {emp.documents.map((d) => (
                                            <Badge
                                                key={d.file_type_id}
                                                variant={d.status === 'expired' ? 'destructive' : 'outline'}
                                                className={`text-xs ${d.status === 'expiring_soon' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' : ''}`}
                                            >
                                                {d.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {emp.employment_type && (
                                    <div className="mt-2">
                                        <Badge variant="outline" className="text-xs">
                                            {emp.employment_type.replace(/([A-Z])/g, ' $1').trim()}
                                        </Badge>
                                    </div>
                                )}
                            </Link>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/50">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="px-3">
                                            {header.isPlaceholder ? null : header.id === 'documents' ? (
                                                <LicenceFilterHeader
                                                    fileTypesByCategory={fileTypesByCategory}
                                                    selectedIds={licenceFilterIds}
                                                    filterMode={licenceFilterMode}
                                                    onSelectedIdsChange={setLicenceFilterIds}
                                                    onFilterModeChange={setLicenceFilterMode}
                                                />
                                            ) : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {!table.getRowModel().rows.length ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Users className="h-8 w-8 opacity-40" />
                                            <p>No employees found</p>
                                            {hasActiveFilters && (
                                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                                    Clear filters
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id} className="group">
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="px-3">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}

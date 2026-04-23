import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import SendForSigningModal from '@/components/signing/send-for-signing-modal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { type ColumnDef, flexRender, getCoreRowModel, type RowSelectionState, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, FilePlus2, Filter, RefreshCcw, RotateCcw, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface EmployeeDocument {
    file_type_id: number;
    name: string;
    status: 'valid' | 'expired' | 'expiring_soon';
}

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    email: string | null;
    pin: string;
    external_id?: string | null;
    eh_employee_id?: string | null;
    employment_type?: string | null;
    worktypes?: { eh_worktype_id: string; name: string }[];
    documents?: EmployeeDocument[];
}

interface DocumentTemplate {
    id: number;
    name: string;
    placeholders: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] | null;
    body_html: string | null;
}

interface FileTypeOption {
    id: number;
    name: string;
    category: string;
}

interface PaginationLinkData {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedEmployees {
    data: Employee[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: PaginationLinkData[];
}

type SortField = 'name' | 'email' | 'employment_type';
type SortDirection = 'asc' | 'desc';

interface Filters {
    search?: string | null;
    employment_type?: string | null;
    licence_ids?: number[];
    licence_mode?: 'has' | 'has_not';
    sort?: SortField;
    direction?: SortDirection;
}

type QueryState = {
    search?: string;
    employment_type?: string;
    licence_ids: number[];
    licence_mode: 'has' | 'has_not';
    sort: SortField;
    direction: SortDirection;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employees', href: '/employees' }];

function sanitizePaginationLabel(label: string) {
    return label.replace(/<[^>]+>/g, '').replace(/&laquo;|&raquo;/g, '').trim();
}

function SortHeader({
    label,
    columnKey,
    currentSort,
    currentDirection,
    onSort,
}: {
    label: string;
    columnKey: SortField;
    currentSort: SortField;
    currentDirection: SortDirection;
    onSort: (columnKey: SortField) => void;
}) {
    const sorted = currentSort === columnKey ? currentDirection : null;

    return (
        <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => onSort(columnKey)}>
            {label}
            {sorted === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="ml-1 h-3 w-3" /> : <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
        </Button>
    );
}

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

                <div className="max-h-72 overflow-y-auto p-2">
                    {fileTypesByCategory.map(([category, types]) => (
                        <div key={category} className="mb-2 last:mb-0">
                            <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{category}</p>
                            {types.map((ft) => (
                                <label key={ft.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50">
                                    <Checkbox checked={selectedIds.has(ft.id)} onCheckedChange={() => toggle(ft.id)} />
                                    <span className="truncate">{ft.name}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                </div>

                {isActive && (
                    <div className="flex items-center justify-between border-t px-3 py-2">
                        <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            onClick={() => onSelectedIdsChange(new Set<number>())}
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
    const { employees, fileTypes, employmentTypes, filters, flash, canSendDocuments, documentTemplates, savedSenderSignatureUrl, appUsers } = usePage<{
        employees: PaginatedEmployees;
        fileTypes: FileTypeOption[];
        employmentTypes: string[];
        filters: Filters;
        flash: { success?: string };
        canSendDocuments: boolean;
        documentTemplates: DocumentTemplate[];
        savedSenderSignatureUrl: string | null;
        appUsers: { id: number; name: string; position: string | null }[];
    }>().props;

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search ?? '');
    const [employmentTypeFilter, setEmploymentTypeFilter] = useState(filters.employment_type ?? 'all');
    const [licenceFilterIds, setLicenceFilterIds] = useState<Set<number>>(new Set(filters.licence_ids ?? []));
    const [licenceFilterMode, setLicenceFilterMode] = useState<'has' | 'has_not'>(filters.licence_mode ?? 'has');
    const [open, setOpen] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastRequestedSearch = useRef(filters.search ?? '');

    useEffect(() => {
        setSearchValue(filters.search ?? '');
        lastRequestedSearch.current = filters.search ?? '';
    }, [filters.search]);

    useEffect(() => {
        setEmploymentTypeFilter(filters.employment_type ?? 'all');
    }, [filters.employment_type]);

    useEffect(() => {
        setLicenceFilterIds(new Set(filters.licence_ids ?? []));
    }, [filters.licence_ids]);

    useEffect(() => {
        setLicenceFilterMode(filters.licence_mode ?? 'has');
    }, [filters.licence_mode]);

    const currentSort = filters.sort ?? 'name';
    const currentDirection = filters.direction ?? 'asc';

    const fileTypesByCategory = useMemo(() => {
        const grouped: Record<string, FileTypeOption[]> = {};
        for (const ft of fileTypes ?? []) {
            const category = ft.category || 'Other';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(ft);
        }
        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [fileTypes]);

    const selectedLicenceIds = useMemo(() => Array.from(licenceFilterIds).sort((a, b) => a - b), [licenceFilterIds]);

    const buildQueryState = (overrides: Partial<QueryState> = {}): QueryState => ({
        search: searchValue.trim() || undefined,
        employment_type: employmentTypeFilter !== 'all' ? employmentTypeFilter : undefined,
        licence_ids: selectedLicenceIds,
        licence_mode: licenceFilterMode,
        sort: currentSort,
        direction: currentDirection,
        ...overrides,
    });

    const buildQuery = (nextState: QueryState) => {
        const params: Record<string, string> = {};

        if (nextState.search) params.search = nextState.search;
        if (nextState.employment_type) params.employment_type = nextState.employment_type;
        if (nextState.licence_ids.length > 0) {
            params.licence_ids = nextState.licence_ids.join(',');
            params.licence_mode = nextState.licence_mode;
        }
        if (nextState.sort !== 'name' || nextState.direction !== 'asc') {
            params.sort = nextState.sort;
            params.direction = nextState.direction;
        }

        return params;
    };

    const applyQuery = (overrides: Partial<QueryState> = {}) => {
        const nextState = buildQueryState(overrides);
        lastRequestedSearch.current = nextState.search ?? '';

        router.get(route('employees.index'), buildQuery(nextState), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    useEffect(() => {
        clearTimeout(searchTimeout.current);

        const trimmedSearch = searchValue.trim();
        if (trimmedSearch === lastRequestedSearch.current) {
            return;
        }

        searchTimeout.current = setTimeout(() => {
            applyQuery({ search: trimmedSearch || undefined });
        }, 400);

        return () => clearTimeout(searchTimeout.current);
    }, [searchValue, employmentTypeFilter, selectedLicenceIds, licenceFilterMode, currentSort, currentDirection]);

    const hasActiveFilters = searchValue.trim() !== '' || employmentTypeFilter !== 'all' || selectedLicenceIds.length > 0;

    const clearFilters = () => {
        setSearchValue('');
        setEmploymentTypeFilter('all');
        setLicenceFilterIds(new Set<number>());
        setLicenceFilterMode('has');
        applyQuery({
            search: undefined,
            employment_type: undefined,
            licence_ids: [],
            licence_mode: 'has',
        });
    };

    const handleEmploymentTypeChange = (value: string) => {
        setEmploymentTypeFilter(value);
        applyQuery({ employment_type: value === 'all' ? undefined : value });
    };

    const handleLicenceIdsChange = (ids: Set<number>) => {
        const nextIds = Array.from(ids).sort((a, b) => a - b);
        setLicenceFilterIds(new Set(nextIds));
        applyQuery({ licence_ids: nextIds });
    };

    const handleLicenceModeChange = (mode: 'has' | 'has_not') => {
        setLicenceFilterMode(mode);
        applyQuery({ licence_mode: mode });
    };

    const handleSortChange = (columnKey: SortField) => {
        const nextDirection: SortDirection = currentSort === columnKey && currentDirection === 'asc' ? 'desc' : 'asc';
        applyQuery({ sort: columnKey, direction: nextDirection });
    };

    const columns: ColumnDef<Employee>[] = [
        ...(canSendDocuments
            ? [
                  {
                      id: 'select',
                      header: ({ table }: any) => (
                          <Checkbox
                              checked={table.getIsAllPageRowsSelected()}
                              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                          />
                      ),
                      cell: ({ row }: any) => (
                          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
                      ),
                      enableSorting: false,
                  } as ColumnDef<Employee>,
              ]
            : []),
        {
            accessorKey: 'name',
            header: () => (
                <SortHeader
                    label="Employee"
                    columnKey="name"
                    currentSort={currentSort}
                    currentDirection={currentDirection}
                    onSort={handleSortChange}
                />
            ),
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
                    {row.original.preferred_name && <span className="text-xs text-muted-foreground">({row.original.preferred_name})</span>}
                </Link>
            ),
        },
        {
            accessorKey: 'email',
            header: () => (
                <SortHeader
                    label="Email"
                    columnKey="email"
                    currentSort={currentSort}
                    currentDirection={currentDirection}
                    onSort={handleSortChange}
                />
            ),
            cell: ({ row }) => {
                const value = row.original.email;
                return value ? (
                    <a href={`mailto:${value.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                        {value.toLowerCase()}
                    </a>
                ) : (
                    <span className="text-sm italic text-muted-foreground">-</span>
                );
            },
        },
        {
            accessorKey: 'employment_type',
            header: () => (
                <SortHeader
                    label="Type"
                    columnKey="employment_type"
                    currentSort={currentSort}
                    currentDirection={currentDirection}
                    onSort={handleSortChange}
                />
            ),
            cell: ({ row }) => {
                const value = row.original.employment_type;
                if (!value) return <span className="text-sm italic text-muted-foreground">N/A</span>;
                const variant = value === 'FullTime' ? 'default' : value === 'Casual' ? 'outline' : 'secondary';
                const label = value.replace(/([A-Z])/g, ' $1').trim();
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
                const documents = row.original.documents;
                if (!documents || documents.length === 0) {
                    return <span className="text-sm italic text-muted-foreground">None</span>;
                }

                return (
                    <div className="flex max-w-xs flex-wrap gap-1">
                        {documents.map((document) => (
                            <Badge
                                key={document.file_type_id}
                                variant={document.status === 'expired' ? 'destructive' : 'outline'}
                                className={`text-xs ${document.status === 'expiring_soon' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' : ''}`}
                            >
                                {document.name}
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
    ];

    const table = useReactTable({
        data: employees.data,
        columns,
        state: { rowSelection },
        onRowSelectionChange: setRowSelection,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
    });

    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number);

    const resultsLabel =
        employees.total === 0 ? 'Showing 0 employees' : `Showing ${employees.from ?? 0}-${employees.to ?? 0} of ${employees.total} employees`;

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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchValue} setSearchQuery={setSearchValue} searchName="name or ID" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={employmentTypeFilter} onValueChange={handleEmploymentTypeChange}>
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

                {selectedLicenceIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">{licenceFilterMode === 'has' ? 'Has:' : 'Missing:'}</span>
                        {selectedLicenceIds.map((id) => {
                            const fileType = fileTypes.find((item) => item.id === id);
                            return (
                                <Badge key={id} variant="secondary" className="gap-1 pr-1 text-xs">
                                    {fileType?.name ?? `#${id}`}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${fileType?.name ?? ''} filter`}
                                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                                        onClick={() => {
                                            const next = new Set(licenceFilterIds);
                                            next.delete(id);
                                            handleLicenceIdsChange(next);
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
                            onClick={() => handleLicenceIdsChange(new Set<number>())}
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Bulk action bar */}
                {selectedIds.length > 0 && canSendDocuments && (
                    <div className="flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
                        <span className="text-sm font-medium">{selectedIds.length} selected</span>
                        <Button size="sm" className="gap-1.5" onClick={() => setShowBulkModal(true)}>
                            <FilePlus2 className="h-3.5 w-3.5" />
                            Send for Signing
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
                            Clear
                        </Button>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">{resultsLabel}</p>

                <div className="flex flex-col gap-2 sm:hidden">
                    {!employees.data.length ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            {searchValue.trim() ? `No employees match "${searchValue.trim()}"` : 'No employees found.'}
                        </div>
                    ) : (
                        employees.data.map((employee) => (
                            <Link key={employee.id} href={`/employees/${employee.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                    <UserInfo
                                        user={{ ...employee, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}
                                        showEmail
                                    />
                                </div>
                                {employee.documents && employee.documents.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {employee.documents.map((document) => (
                                            <Badge
                                                key={document.file_type_id}
                                                variant={document.status === 'expired' ? 'destructive' : 'outline'}
                                                className={`text-xs ${document.status === 'expiring_soon' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' : ''}`}
                                            >
                                                {document.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {employee.employment_type && (
                                    <div className="mt-2">
                                        <Badge variant="outline" className="text-xs">
                                            {employee.employment_type.replace(/([A-Z])/g, ' $1').trim()}
                                        </Badge>
                                    </div>
                                )}
                            </Link>
                        ))
                    )}
                </div>

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
                                                    onSelectedIdsChange={handleLicenceIdsChange}
                                                    onFilterModeChange={handleLicenceModeChange}
                                                />
                                            ) : (
                                                flexRender(header.column.columnDef.header, header.getContext())
                                            )}
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
                                    <TableRow key={row.id} className="group" data-state={row.getIsSelected() ? 'selected' : undefined}>
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

                {employees.last_page > 1 && (
                    <Pagination className="justify-end">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious href={employees.prev_page_url ?? undefined} />
                            </PaginationItem>
                            {employees.links.slice(1, -1).map((link, index) => {
                                const label = sanitizePaginationLabel(link.label);

                                if (label === '...') {
                                    return (
                                        <PaginationItem key={`ellipsis-${index}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    );
                                }

                                return (
                                    <PaginationItem key={label}>
                                        <PaginationLink href={link.url ?? undefined} isActive={link.active}>
                                            {label}
                                        </PaginationLink>
                                    </PaginationItem>
                                );
                            })}
                            <PaginationItem>
                                <PaginationNext href={employees.next_page_url ?? undefined} />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
            </div>

            {/* Bulk send modal */}
            {canSendDocuments && (
                <SendForSigningModal
                    open={showBulkModal}
                    onOpenChange={(open) => {
                        setShowBulkModal(open);
                        if (!open) setRowSelection({});
                    }}
                    templates={documentTemplates ?? []}
                    savedSenderSignatureUrl={savedSenderSignatureUrl}
                    appUsers={appUsers ?? []}
                    bulkEmployees={employees.data.filter((e) => selectedIds.includes(e.id)).map((e) => ({
                        id: e.id,
                        name: e.preferred_name || e.name,
                        email: e.email,
                    }))}
                />
            )}
        </AppLayout>
    );
}

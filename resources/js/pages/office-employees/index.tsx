import InputSearch from '@/components/inputSearch';
import SendForSigningModal from '@/components/signing/send-for-signing-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { type ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type RowSelectionState, type SortingState, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, FilePlus2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface OfficeEmployee {
    id: number;
    name: string;
    preferred_name: string | null;
    email: string | null;
    employment_type: string | null;
    employment_agreement: string | null;
    start_date: string | null;
}

interface DocumentTemplate {
    id: number;
    name: string;
    placeholders: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] | null;
    body_html: string | null;
}

interface PageProps {
    employees: OfficeEmployee[];
    canSendDocuments: boolean;
    documentTemplates: DocumentTemplate[];
    savedSenderSignatureUrl: string | null;
    appUsers: { id: number; name: string; position: string | null }[];
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Office Employees', href: '/office-employees' }];

function SortHeader({ label, column }: { label: string; column: any }) {
    const sorted = column.getIsSorted();
    return (
        <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => column.toggleSorting(sorted === 'asc')}>
            {label}
            {sorted === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="ml-1 h-3 w-3" /> : <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
        </Button>
    );
}

export default function OfficeEmployeesList() {
    const { employees, canSendDocuments, documentTemplates, savedSenderSignatureUrl, appUsers } = usePage<PageProps>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [showBulkModal, setShowBulkModal] = useState(false);

    const filteredEmployees = useMemo(() => {
        if (!searchQuery) return employees;
        const query = searchQuery.toLowerCase();
        return employees.filter(
            (e) =>
                e.name.toLowerCase().includes(query) ||
                e.preferred_name?.toLowerCase().includes(query) ||
                e.email?.toLowerCase().includes(query),
        );
    }, [employees, searchQuery]);

    const columns: ColumnDef<OfficeEmployee>[] = useMemo(
        () => [
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
                      } as ColumnDef<OfficeEmployee>,
                  ]
                : []),
            {
                accessorKey: 'name',
                header: ({ column }) => <SortHeader label="Employee" column={column} />,
                cell: ({ row }) => (
                    <Link href={`/employees/${row.original.id}`} className="flex items-center gap-2">
                        <UserInfo
                            user={{
                                ...row.original,
                                preferred_name: row.original.preferred_name ?? undefined,
                                email: row.original.email ?? '',
                                email_verified_at: '',
                                created_at: '',
                                updated_at: '',
                                phone: '',
                            }}
                            showEmail={false}
                        />
                    </Link>
                ),
            },
            {
                accessorKey: 'email',
                header: ({ column }) => <SortHeader label="Email" column={column} />,
                cell: ({ row }) => row.original.email ?? '—',
            },
            {
                accessorKey: 'employment_type',
                header: ({ column }) => <SortHeader label="Employment type" column={column} />,
                cell: ({ row }) => row.original.employment_type ?? '—',
            },
            {
                accessorKey: 'employment_agreement',
                header: ({ column }) => <SortHeader label="Agreement" column={column} />,
                cell: ({ row }) => <span className="text-sm">{row.original.employment_agreement ?? '—'}</span>,
            },
            {
                accessorKey: 'start_date',
                header: ({ column }) => <SortHeader label="Start date" column={column} />,
                cell: ({ row }) => row.original.start_date ?? '—',
            },
        ],
        [canSendDocuments],
    );

    const table = useReactTable({
        data: filteredEmployees,
        columns,
        state: { sorting, rowSelection },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Office Employees" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Office Employees</h1>
                        <p className="text-sm text-muted-foreground">
                            Salaried staff — {employees.length} {employees.length === 1 ? 'person' : 'people'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-full sm:max-w-xs">
                            <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or email" />
                        </div>
                    </div>
                </div>

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

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                        No office employees found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
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
                    bulkEmployees={filteredEmployees.filter((e) => selectedIds.includes(e.id)).map((e) => ({
                        id: e.id,
                        name: e.preferred_name || e.name,
                        email: e.email,
                    }))}
                />
            )}
        </AppLayout>
    );
}

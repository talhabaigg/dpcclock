import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, RefreshCcw, RotateCcw, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    external_id?: string;
    eh_employee_id?: string;
    worktypes?: { eh_worktype_id: string; name: string }[];
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

export default function EmployeesList() {
    const { employees, flash } = usePage<{ employees: Employee[]; flash: { success?: string } }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

    const filteredEmployees = useMemo(() => {
        if (!searchQuery) return employees;
        const query = searchQuery.toLowerCase();
        return employees.filter(
            (employee) =>
                employee.name.toLowerCase().includes(query) ||
                employee.external_id?.toLowerCase().includes(query) ||
                employee.eh_employee_id?.toLowerCase().includes(query),
        );
    }, [employees, searchQuery]);

    const columns: ColumnDef<Employee>[] = useMemo(
        () => [
            {
                accessorKey: 'name',
                header: ({ column }) => <SortHeader label="Employee" column={column} />,
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <UserInfo
                            user={{
                                ...row.original,
                                email_verified_at: '',
                                created_at: '',
                                updated_at: '',
                                phone: '',
                            }}
                        />
                    </div>
                ),
            },
            {
                accessorKey: 'external_id',
                header: ({ column }) => <SortHeader label="External ID" column={column} />,
                cell: ({ row }) => {
                    const val = row.original.external_id?.trim();
                    return val ? (
                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{val}</code>
                    ) : (
                        <span className="text-muted-foreground text-sm italic">N/A</span>
                    );
                },
            },
            {
                accessorKey: 'eh_employee_id',
                header: ({ column }) => <SortHeader label="EH Employee ID" column={column} />,
                cell: ({ row }) => {
                    const val = row.original.eh_employee_id?.trim();
                    return val ? (
                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{val}</code>
                    ) : (
                        <span className="text-muted-foreground text-sm italic">N/A</span>
                    );
                },
            },
            {
                id: 'worktypes',
                header: 'Work Types',
                cell: ({ row }) => {
                    const worktypes = row.original.worktypes;
                    if (!worktypes || worktypes.length === 0) {
                        return <span className="text-muted-foreground text-sm italic">None assigned</span>;
                    }
                    return (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {worktypes.slice(0, 2).map((wt) => (
                                <Badge key={wt.eh_worktype_id} variant="secondary" className="text-xs">
                                    {wt.name}
                                </Badge>
                            ))}
                            {worktypes.length > 2 && (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="outline" className="text-muted-foreground hover:bg-muted cursor-pointer text-xs">
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Flash Message */}
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
                    <div className="flex items-center gap-2">
                        <Link href="/employees/sync" method="get">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                <RefreshCcw className="h-4 w-4" />
                                Sync Employees
                            </Button>
                        </Link>
                        <Link href="/employees/worktypes/sync" method="get">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                <RefreshCcw className="h-4 w-4" />
                                Sync Worktypes
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredEmployees.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {searchQuery ? `No employees match "${searchQuery}"` : 'No employees found.'}
                        </div>
                    ) : (
                        filteredEmployees.map((emp) => (
                            <div key={emp.id} className="rounded-lg border p-3">
                                <div className="flex items-center gap-2">
                                    <UserInfo
                                        user={{ ...emp, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}
                                        showEmail
                                    />
                                </div>
                                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                                    {emp.external_id?.trim() && <span>Ext: {emp.external_id}</span>}
                                    {emp.eh_employee_id?.trim() && <span>EH: {emp.eh_employee_id}</span>}
                                </div>
                                {emp.worktypes && emp.worktypes.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {emp.worktypes.map((wt) => (
                                            <Badge key={wt.eh_worktype_id} variant="secondary" className="text-[10px]">
                                                {wt.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {!table.getRowModel().rows.length ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <Users className="h-8 w-8 opacity-40" />
                                            <p>No employees found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
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

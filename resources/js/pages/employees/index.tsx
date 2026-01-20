import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpDown, CheckCircle2, RefreshCcw, RotateCcw, Users } from 'lucide-react';
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

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Employees',
        href: '/employees',
    },
];

export default function EmployeesList() {
    const { employees, flash } = usePage<{ employees: Employee[]; flash: { success?: string } }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const { sortedItems: sortedEmployees, handleSort } = useSortableData<Employee>(employees, { field: 'name', order: 'asc' });

    const filteredEmployees = useMemo(() => {
        if (!searchQuery) return sortedEmployees;
        const query = searchQuery.toLowerCase();
        return sortedEmployees.filter(
            (employee) =>
                employee.name.toLowerCase().includes(query) ||
                employee.external_id?.toLowerCase().includes(query) ||
                employee.eh_employee_id?.toLowerCase().includes(query),
        );
    }, [sortedEmployees, searchQuery]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            <Users className="h-6 w-6 text-primary" />
                            Employees
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''} found
                        </p>
                    </div>

                    {/* Actions & Search */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-64">
                            <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/employees/sync" method="get">
                                <Button variant="outline" className="gap-2 transition-all hover:border-primary/50" onClick={() => setOpen(true)}>
                                    <RefreshCcw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                                    Sync Employees
                                </Button>
                            </Link>
                            <Link href="/employees/worktypes/sync" method="get">
                                <Button variant="outline" className="gap-2 transition-all hover:border-primary/50" onClick={() => setOpen(true)}>
                                    <RefreshCcw className="h-4 w-4" />
                                    Sync Worktypes
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Flash Message */}
                {flash.success && (
                    <Alert className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertTitle className="text-emerald-700 dark:text-emerald-400">Success</AlertTitle>
                        <AlertDescription className="text-emerald-600 dark:text-emerald-300">{flash.success}</AlertDescription>
                    </Alert>
                )}

                {/* Table Card */}
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="pl-6">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-3 h-8 gap-1 font-medium hover:bg-transparent"
                                                onClick={() => handleSort('name')}
                                            >
                                                Employee
                                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-3 h-8 gap-1 font-medium hover:bg-transparent"
                                                onClick={() => handleSort('external_id')}
                                            >
                                                External ID
                                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-3 h-8 gap-1 font-medium hover:bg-transparent"
                                                onClick={() => handleSort('eh_employee_id')}
                                            >
                                                EH Employee ID
                                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>Work Types</TableHead>
                                        <TableHead className="pr-6 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEmployees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center">
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
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
                                        filteredEmployees.map((employee) => (
                                            <TableRow key={employee.id} className="group transition-colors hover:bg-muted/50">
                                                <TableCell className="pl-6">
                                                    <UserInfo
                                                        user={{
                                                            ...employee,
                                                            email_verified_at: '',
                                                            created_at: '',
                                                            updated_at: '',
                                                            phone: '',
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {employee.external_id?.trim() ? (
                                                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                                            {employee.external_id}
                                                        </code>
                                                    ) : (
                                                        <span className="text-sm italic text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {employee.eh_employee_id?.trim() ? (
                                                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                                            {employee.eh_employee_id}
                                                        </code>
                                                    ) : (
                                                        <span className="text-sm italic text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {employee.worktypes && employee.worktypes.length > 0 ? (
                                                            <>
                                                                {employee.worktypes.slice(0, 2).map((worktype) => (
                                                                    <Badge
                                                                        key={worktype.eh_worktype_id}
                                                                        variant="secondary"
                                                                        className="text-xs transition-transform hover:scale-105"
                                                                    >
                                                                        {worktype.name}
                                                                    </Badge>
                                                                ))}
                                                                {employee.worktypes.length > 2 && (
                                                                    <TooltipProvider delayDuration={200}>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="cursor-pointer text-xs text-muted-foreground transition-all hover:bg-muted"
                                                                                >
                                                                                    +{employee.worktypes.length - 2}
                                                                                </Badge>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="bottom" className="max-w-xs p-3">
                                                                                <p className="mb-2 text-xs font-medium">All Work Types</p>
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {employee.worktypes.map((worktype) => (
                                                                                        <Badge
                                                                                            key={worktype.eh_worktype_id}
                                                                                            variant="secondary"
                                                                                            className="text-xs"
                                                                                        >
                                                                                            {worktype.name}
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-sm italic text-muted-foreground">None assigned</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-6 text-right">
                                                    <Link href={`/employee/${employee.id}/worktypes/sync`}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2 opacity-0 transition-all group-hover:opacity-100"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                            Retry Sync
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

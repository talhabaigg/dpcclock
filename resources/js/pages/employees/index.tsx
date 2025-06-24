import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserInfo } from '@/components/user-info';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
// Define the Employee type
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    external_id?: string; // Optional, assuming it's not part of the schema yet
    eh_employee_id?: string; // Optional, assuming it's not part of the schema yet
    worktypes?: { eh_worktype_id: string; name: string }[]; // Optional, updated to fix the error
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Employees',
        href: '/employees',
    },
];

const isLoading = false;

export default function EmployeesList() {
    const { employees, flash } = usePage<{ employees: Employee[]; flash: { success?: string } }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const { sortedItems: sortedEmployees, handleSort } = useSortableData<Employee>(employees); //useSortableData is a custom hook to sort table data
    const filteredEmployees = useMemo(() => {
        return searchQuery ? employees.filter((employee) => employee.name.toLowerCase().includes(searchQuery.toLowerCase())) : sortedEmployees;
    }, [sortedEmployees, searchQuery]);
    const [open, setOpen] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="items-left m-2 flex flex-col justify-start gap-2 sm:flex-row md:justify-between">
                <div className="flex items-center">
                    <Link href="/employees/sync" method="get">
                        <Button variant="outline" className="w-32" onClick={() => setOpen(true)}>
                            {isLoading ? 'Syncing...' : 'Sync Employees'}
                        </Button>
                    </Link>
                    {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}
                </div>
                <div className="relative w-full sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            <LoadingDialog open={open} setOpen={setOpen} />

            <Card className="mx-auto mb-2 max-w-sm p-0 sm:max-w-full md:mx-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <div className="flex items-center">
                                    {' '}
                                    <Label>Name</Label>{' '}
                                    <Button size="sm" variant="ghost" onClick={() => handleSort('name')}>
                                        <ArrowUpDown className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center">
                                    {' '}
                                    <Label>External ID</Label>{' '}
                                    <Button size="sm" variant="ghost" onClick={() => handleSort('external_id')}>
                                        <ArrowUpDown className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center">
                                    {' '}
                                    <Label>EH Employee ID</Label>{' '}
                                    <Button size="sm" variant="ghost" onClick={() => handleSort('eh_employee_id')}>
                                        <ArrowUpDown className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableHead>
                            <TableHead>Work Types</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell className="flex items-center gap-2 font-medium">
                                    <UserInfo user={{ ...employee, email_verified_at: '', created_at: '', updated_at: '' }}></UserInfo>
                                </TableCell>

                                <TableCell>{employee.external_id?.trim() || 'N/A'}</TableCell>
                                <TableCell>{employee.eh_employee_id?.trim() || 'N/A'}</TableCell>

                                <TableCell>
                                    {employee.worktypes && employee.worktypes.length > 0
                                        ? employee.worktypes.map((worktype: { eh_worktype_id: string; name: string }) => (
                                              <Badge key={worktype.eh_worktype_id} className="mr-2">
                                                  {worktype.name}
                                              </Badge>
                                          ))
                                        : 'No work types available'}
                                </TableCell>
                                <TableCell>
                                    <Link href={`/employee/${employee.id}/worktypes/sync`}>
                                        <Button variant="outline" className="w-32">
                                            Retry Sync
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </AppLayout>
    );
}

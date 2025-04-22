import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';
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

let isLoading = false;

export default function EmployeesList() {
    const { employees, flash } = usePage<{ employees: Employee[]; flash: { success?: string } }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredEmployees = employees.filter((employee) => employee.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="flex items-center">
                    <Link href="/employees/sync" method="get">
                        <Button variant="outline" className="w-32">
                            {isLoading ? 'Syncing...' : 'Sync Employees'}
                        </Button>
                    </Link>
                    {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}
                </div>
                <div className="relative w-72 sm:w-1/4">
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

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>External ID</TableHead>
                            <TableHead>EH Employee ID</TableHead>
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
            </div>
        </AppLayout>
    );
}

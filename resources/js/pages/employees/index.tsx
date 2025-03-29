import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Link } from '@inertiajs/react';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge"

// Define the Employee type
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    external_id?: string; // Optional, assuming it's not part of the schema yet
    eh_employee_id?: string; // Optional, assuming it's not part of the schema yet
    worktypes?: string; // Optional, added to fix the error
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="flex items-center gap-2 m-2">
            <Link href="/employees/sync" method="get">
                <Button variant="outline" className="w-32" >
                    {isLoading ? 'Syncing...' : 'Sync Employees'}
                </Button>
            </Link>
            {flash.success && (
                    <div className="m-2 text-green-500">
                        {flash.success}
                    </div>
                )}
            </div> 

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>External ID</TableHead>
                            <TableHead>EH Employee ID</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {employees.map((employee) => (
                        <TableRow key={employee.id}>
                            <TableCell>{employee.id}</TableCell>
                            <TableCell>{employee.name.trim()}</TableCell>
                            <TableCell>{employee.external_id?.trim() || 'N/A'}</TableCell>
                            <TableCell>{employee.eh_employee_id?.trim() || 'N/A'}</TableCell>
                           
                            <TableCell>
                                {employee.worktypes && employee.worktypes.length > 0 
                                    ? employee.worktypes.map((worktype) => (
                                        <Badge key={worktype.eh_worktype_id} className="mr-2 ">{worktype.name}</Badge>
                                    ))
                                    : 'N/A'
                                }
                                </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

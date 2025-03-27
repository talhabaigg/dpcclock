import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { usePage } from "@inertiajs/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import axios from 'axios';

// Define the Employee type
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    external_id?: string; // Optional, assuming it's not part of the schema yet
    eh_employee_id?: string; // Optional, assuming it's not part of the schema yet
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Employees',
        href: '/employees',
    },
];

const syncEmployees = async () => {
    try {
        const response = await axios.get('/employees/sync');
        console.log('Sync successful:', response.data);
        // Optionally, you can handle the response data here
    } catch (error) {
        console.error('Error syncing employees:', error);
    }
};

export default function EmployeesList() {
    const { employees } = usePage<{ employees: Employee[] }>().props;
    console.log(employees); // Make sure the data structure is correct

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <Button variant="outline" className="w-32 m-2" onClick={() => syncEmployees()}>
                Sync Employees
            </Button>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Department</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {employees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell>{employee.id}</TableCell>
                                <TableCell>{employee.name}</TableCell>
                                <TableCell>{employee.external_id || 'N/A'}</TableCell> {/* Show N/A if no position */}
                                <TableCell>{employee.eh_employee_id || 'N/A'}</TableCell> {/* Show N/A if no department */}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

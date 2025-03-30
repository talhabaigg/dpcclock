import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge"
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Timesheets',
        href: '/clocks',
    },
];

export default function TimesheetList() {
    const { timesheets, flash } = usePage<{ timesheets: Employee[] }>().props;
    let isLoading = false;
    console.log('timesheets', timesheets);
    const handleSync = () => {
        setIsLoading(true);

        // Trigger the download action
        window.location.href = '/clocks/eh/sync';  // Redirect to the route that triggers the download
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="flex items-center gap-2 m-2">
            <Link  onClick={handleSync} href="/clocks/eh/sync" className="flex items-center gap-2">
                <Button variant="outline" className="" >
                    {isLoading ? 'Syncing...' : 'Send timesheets to Employment Hero'}
                </Button>
            </Link>
            {flash.success && (
                    <div className="m-2 text-green-500">
                        {flash.success}
                    </div>
                )}
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
                <Table >
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee Id</TableHead>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Start time</TableHead>
                            <TableHead>End time</TableHead>
                            <TableHead>Worktype</TableHead>
                            <TableHead>Location Default Shift Conditions</TableHead>
                            <TableHead>Location External ID</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {timesheets.map((timesheets) => (
                            <TableRow key={timesheets.id}>
                              <TableCell>{timesheets.eh_employee_id}</TableCell>
                                <TableCell>{timesheets.employee.name}</TableCell>
                                <TableCell>{new Date(timesheets.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                                <TableCell>{timesheets.clock_out ? new Date(timesheets.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Still clocked in'}</TableCell>
                                <TableCell>
                                    {timesheets.employee?.worktypes?.length > 0
                                        ? timesheets.employee.worktypes.map(wt => wt.name).join(', ')
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                    {timesheets.location?.worktypes?.length > 0
                                        ? timesheets.location.worktypes.map(wt => wt.name).join(', ')
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        {timesheets.location?.external_id || 'N/A'}
                                        </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

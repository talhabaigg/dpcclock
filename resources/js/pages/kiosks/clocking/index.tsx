import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Timesheets', href: '/clocks' }];

type Worktype = { name: string };
type Employee = {
    id: number;
    name: string;
    eh_employee_id: number;
    worktypes?: Worktype[];
};
type Location = {
    external_id: string;
    worktypes?: Worktype[];
};
type Clock = {
    id: number;
    eh_kiosk_id: number;
    eh_employee_id: number;
    clock_in: string;
    clock_out: string | null;
    eh_location_id: number;
    status?: string;
    employee: Employee;
    location?: Location;
};

type TimesheetsGroupedByDate = {
    [date: string]: {
        [employeeId: string]: Clock[];
    };
};

export default function TimesheetList() {
    const { timesheets, flash } = usePage<{
        timesheets: TimesheetsGroupedByDate;
        flash: { success?: string };
    }>().props;

    const [isLoading, setIsLoading] = useState(false);

    const handleSync = () => {
        setIsLoading(true);
        window.location.href = '/clocks/eh/sync';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheets" />
            <div className="m-2 flex items-center gap-2">
                <Link onClick={handleSync} href="/clocks/eh/sync" className="flex items-center gap-2">
                    <Button variant="outline">{isLoading ? 'Syncing...' : 'Send timesheets to Employment Hero'}</Button>
                </Link>
                {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}
            </div>

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4">
                {Object.entries(timesheets).map(([date, employeeGroup]) => (
                    <div key={date} className="border-b pb-4">
                        <h2 className="mb-4 text-xl font-bold text-gray-800">📅 {date}</h2>

                        {Object.entries(employeeGroup).map(([employeeId, clocks]) => {
                            const employee = clocks[0]?.employee;

                            return (
                                <div key={employeeId} className="mb-4">
                                    <h3 className="mb-2 text-lg font-semibold text-gray-700">👤 {employee?.name || 'Unknown Employee'}</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Employee ID</TableHead>
                                                <TableHead>Clock In</TableHead>
                                                <TableHead>Clock Out</TableHead>
                                                <TableHead>Worktype</TableHead>
                                                <TableHead>Location Conditions</TableHead>
                                                <TableHead>Location ID</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {clocks.map((clock) => (
                                                <TableRow key={clock.id}>
                                                    <TableCell>
                                                        {clock.status === 'synced' && (
                                                            <Badge variant="outline" className="text-green-500">
                                                                Synced
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{clock.eh_employee_id}</TableCell>
                                                    <TableCell>
                                                        {new Date(clock.clock_in).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        {clock.clock_out
                                                            ? new Date(clock.clock_out).toLocaleTimeString([], {
                                                                  hour: '2-digit',
                                                                  minute: '2-digit',
                                                              })
                                                            : 'Still clocked in'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {employee?.worktypes?.length ? employee.worktypes.map((wt) => wt.name).join(', ') : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {clock.location?.worktypes?.length
                                                            ? clock.location.worktypes.map((wt) => wt.name).join(', ')
                                                            : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>{clock.location?.external_id || 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </AppLayout>
    );
}

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import React from 'react';

// Define the Kiosk type
interface Kiosk {
    id: number;
    name: string;
    eh_location_id: string;
    location?: {
        name?: string;
    };
    default_start_time: string;
    default_end_time: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Kiosks', href: '/kiosks' }];

export default function KiosksList() {
    const { kiosks, flash } = usePage<{ kiosks: Kiosk[]; flash?: { success?: string } }>().props;
    const [loading, setLoading] = React.useState(false);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kiosks" />

            <div className="m-2 flex items-center gap-2">
                <Link href="/kiosks/sync" method="get">
                    <Button variant="outline" className="w-32">
                        Sync Kiosk
                    </Button>
                </Link>
                <Link href="/employees/kiosks/update" method="get">
                    <Button variant="outline" className="w-full" onClick={() => setLoading(true)} disabled={loading}>
                        {loading ? 'Syncing...' : 'Sync Employees with Kiosk'}
                    </Button>
                </Link>
                {flash?.success && <div className="text-green-500">{flash.success}</div>}
            </div>

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kiosk ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Location Name</TableHead>
                            <TableHead>Default Start Time</TableHead>
                            <TableHead>Default End Time</TableHead>
                            <TableHead>Actions</TableHead>
                            <TableHead>Settings</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {kiosks.map((kiosk) => (
                            <TableRow key={kiosk.id}>
                                <TableCell>{kiosk.eh_location_id}</TableCell>
                                <TableCell>{kiosk.name}</TableCell>
                                <TableCell>{kiosk.location?.name?.trim() || 'N/A'}</TableCell>
                                <TableCell>{kiosk.default_start_time}</TableCell>
                                <TableCell>{kiosk.default_end_time}</TableCell>

                                <TableCell>
                                    <Link href={`/kiosks/${kiosk.id}`}>
                                        <Button>Open</Button>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/kiosks/${kiosk.id}/edit`}>
                                        <Button variant="outline">Settings</Button>
                                    </Link>
                                </TableCell>
                                {/* <TableCell>
                                    {kiosk.employees.length > 0 ? (
                                        <div className="space-y-1">
                                            {kiosk.employees.map((employee) => (
                                                <div key={employee.id} className="text-sm">
                                                    {employee.name} {employee.pivot?.zone ? `(Zone ${employee.pivot.zone})` : ''}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Link href={`/kiosks/${kiosk.id}/settings/create`}>
                                            <Button variant="outline">Settings</Button>
                                        </Link>
                                    )}
                                </TableCell> */}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

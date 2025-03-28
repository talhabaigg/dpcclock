import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Locations',
        href: '/locations',
    },
];

export default function KiosksList() {
    const { kiosks } = usePage<{ kiosks: Kiosk[] }>().props;
    console.log(kiosks); // Make sure the data structure is correct

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kiosk ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Location Name</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {kiosks.map((kiosk) => (
                            <TableRow key={kiosk.id}>
                                <TableCell>{kiosk.eh_location_id}</TableCell>
                                <TableCell>{kiosk.name}</TableCell>
                                <TableCell>{kiosk.location.name || 'N/A'}</TableCell> {/* Show N/A if no position */}
                                <TableCell>
                                    <Link href={`/kiosks/${kiosk.id}`}>
                                        <Button>Open</Button>
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

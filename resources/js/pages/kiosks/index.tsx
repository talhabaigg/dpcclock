import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

// Define the Kiosk type
interface Kiosk {
    id: number;
    name: string;
    eh_location_id: string;
    location?: {
        name?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Locations', href: '/locations' },
];

export default function KiosksList() {
    const { kiosks, flash } = usePage<{ kiosks: Kiosk[]; flash?: { success?: string } }>().props;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kiosks" />

            <div className="flex items-center gap-2 m-2">
                <Link href="/kiosks/sync" method="get">
                    <Button variant="outline" className="w-32">
                        Sync Kiosk
                    </Button>
                </Link>
                {flash?.success && (
                    <div className="text-green-500">{flash.success}</div>
                )}
            </div>

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
                                <TableCell>{kiosk.location?.name?.trim() || 'N/A'}</TableCell>
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

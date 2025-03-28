import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Locations',
        href: '/locations',
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

export default function LocationsList() {
    const { locations } = usePage<{ locations: Employee[] }>().props;
    console.log(locations); // Make sure the data structure is correct

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>External ID</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {locations.map((location) => (
                            <TableRow key={location.id}>
                                <TableCell>{location.eh_location_id}</TableCell>
                                <TableCell>{location.name}</TableCell>
                                <TableCell>{location.external_id || 'N/A'}</TableCell> {/* Show N/A if no position */}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

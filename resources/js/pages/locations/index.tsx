import { Badge } from '@/components/ui/badge';
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

export default function LocationsList() {
    const { locations, flash } = usePage<{ locations: Employee[] }>().props;
    let isLoading = false;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="m-2 flex items-center gap-2">
                <Link href="/locations/sync" method="get">
                    <Button variant="outline" className="w-32">
                        {isLoading ? 'Syncing...' : 'Sync Locations'}
                    </Button>
                </Link>
                {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>External ID</TableHead>
                            <TableHead>Default Shift Conditions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {locations.map((location) => (
                            <TableRow key={location.id}>
                                <TableCell>{location.eh_location_id}</TableCell>
                                <TableCell>{location.name}</TableCell>
                                <TableCell>{location.external_id || 'N/A'}</TableCell>
                                <TableCell>
                                    {location.worktypes && location.worktypes.length > 0
                                        ? location.worktypes.map((worktype) => (
                                              <Badge key={worktype.eh_worktype_id} className="mr-2">
                                                  {worktype.name}
                                              </Badge>
                                          ))
                                        : 'N/A'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

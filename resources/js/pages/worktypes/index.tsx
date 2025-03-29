import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Worktypes',
        href: '/worktypes',
    },
];

export default function LocationsList() {
    const { worktypes, flash } = usePage<{ worktypes: Employee[] }>().props;
    let isLoading = false;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employees" />
            <div className="flex items-center gap-2 m-2">
            <Link  href={route('worktypes.sync')}>
                <Button variant="outline" className="w-32" >
                    {isLoading ? 'Syncing...' : 'Sync Worktypes'}
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
                            <TableHead>Mapping Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {worktypes.map((worktype) => (
                            <TableRow key={worktype.id}>
                              <TableCell>{worktype.id}</TableCell>
                                <TableCell>{worktype.name}</TableCell>
                                <TableCell>{worktype.eh_worktype_id|| 'N/A'}</TableCell>
                                <TableCell>{worktype.mapping_type|| 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

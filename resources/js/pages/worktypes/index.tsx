import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { RefreshCcw, Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Worktypes',
        href: '/worktypes',
    },
];

type Employee = {
    id: number;
    name: string;
    email: string;
    external_id?: string; // Optional, assuming it's not part of the schema yet
    eh_worktype_id?: string; // Optional, assuming it's not part of the schema yet
    worktypes?: { eh_worktype_id: string; name: string }[]; // Optional, updated to fix the error
    mapping_type?: string; // Optional, assuming it's not part of the schema yet
};

export default function LocationsList() {
    const { worktypes, flash } = usePage<{ worktypes: Employee[]; flash: { success: string; error: string } }>().props;
    const isLoading = false;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredWorktypes = worktypes.filter((worktype) => worktype.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Worktypes" />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            type="text"
                            placeholder="Search by name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {flash.success && <div className="text-sm text-green-500">{flash.success}</div>}
                        <Link href={route('worktypes.sync')}>
                            <Button variant="outline" onClick={() => setOpen(true)}>
                                <RefreshCcw /> {isLoading ? 'Syncing...' : 'Sync Worktypes'}
                            </Button>
                        </Link>
                    </div>
                </div>

                <Card className="p-0">
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
                            {filteredWorktypes.map((worktype) => (
                                <TableRow key={worktype.id}>
                                    <TableCell>{worktype.id}</TableCell>
                                    <TableCell>{worktype.name}</TableCell>
                                    <TableCell>{worktype.eh_worktype_id || 'Not Found'}</TableCell>
                                    <TableCell>{worktype.mapping_type || 'Not Found'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            <LoadingDialog open={open} setOpen={setOpen} />
        </AppLayout>
    );
}

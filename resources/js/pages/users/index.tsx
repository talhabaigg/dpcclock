import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: '/users',
    },
];

type Permission = {
    id: number;
    name: string;
};

type User = {
    id: number;
    name: string;
    email: string;
    created_at: string;
    roles: {
        permissions: Permission[];
        id: number;
        name: string;
    }[];
};

export default function LocationsList() {
    const { users, flash } = usePage<{ users: User[]; flash: { success: string; error: string } }>().props;
    let isLoading = false;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="m-2 flex items-center gap-2">{flash.success && <div className="m-2 text-green-500">{flash.success}</div>}</div>
                <div className="relative w-72 sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead>Actions</TableHead>

                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.id}</TableCell>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    {user.roles.map((role) => (
                                        <Badge key={role.id} className="m-1">
                                            {role.name}
                                        </Badge>
                                    ))}
                                </TableCell>
                                <TableCell className="flex flex-col">
                                    {user.roles
                                        ?.flatMap((role) => role.permissions || [])
                                        .map((permission) => (
                                            <Badge key={permission.id} className="m-1">
                                                {permission.name}
                                            </Badge>
                                        ))}
                                </TableCell>
                                <TableCell>
                                    <Link href={`/users/edit/${user.id}`}>Edit</Link>
                                </TableCell>
                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

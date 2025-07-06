import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    const { users, flash, roles } = usePage<{ users: User[]; flash: { success: string; error: string }; roles: any[] }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const { data, setData, put, processing, errors } = useForm({
        userId: 0,
        name: '',
        email: '',
        roles: '',
    });

    useEffect(() => {
        if (data.userId && data.roles) {
            console.log(data);
            put(`/users/${data.userId}`, {
                preserveScroll: true,
                onSuccess: () => {
                    console.log('Role updated successfully');
                },
                onError: (errors) => {
                    console.error('Error updating role:', errors);
                },
            });
        }
    }, [data.userId, data.roles]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="m-2 flex flex-col items-center justify-between gap-2 sm:flex-row">
                <div className="relative w-full max-w-96 min-w-96 sm:w-1/4">
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
            <Card className="mx-auto mb-2 max-w-sm p-0 sm:mx-2 sm:max-w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead>Actions</TableHead>
                            <TableHead>Joined</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.id}</TableCell>
                                <TableCell className="flex items-center space-x-2">
                                    <UserInfo user={{ ...user, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}></UserInfo>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Select
                                        value={user.roles[0]?.id.toString()}
                                        onValueChange={(value) => setData({ userId: user.id, name: user.name, email: user.email, roles: value })}
                                    >
                                        <SelectTrigger>
                                            {' '}
                                            <SelectValue placeholder="Select Role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role) => (
                                                <SelectItem key={role.id} value={role.id.toString()}>
                                                    {role.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/users/edit/${user.id}`}>Edit</Link>
                                </TableCell>
                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </AppLayout>
    );
}

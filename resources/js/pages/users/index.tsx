import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Loader2, Pencil, Plus, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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

export default function UsersIndex() {
    const { users, roles, flash } = usePage<{
        users: User[];
        roles: { id: number; name: string }[];
        flash: { success: string; error: string };
    }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        userId: number;
        userName: string;
        newRole: string;
        newRoleName: string;
    }>({
        open: false,
        userId: 0,
        userName: '',
        newRole: '',
        newRoleName: '',
    });

    const { data, setData, put, processing } = useForm({
        userId: 0,
        name: '',
        email: '',
        roles: '',
    });

    // Handle role change confirmation
    const handleRoleChange = (user: User, newRoleId: string) => {
        const newRole = roles.find((r) => r.id.toString() === newRoleId);
        if (!newRole) return;

        setConfirmDialog({
            open: true,
            userId: user.id,
            userName: user.name,
            newRole: newRoleId,
            newRoleName: newRole.name,
        });
    };

    const confirmRoleChange = () => {
        const user = users.find((u) => u.id === confirmDialog.userId);
        if (!user) return;

        setData({
            userId: confirmDialog.userId,
            name: user.name,
            email: user.email,
            roles: confirmDialog.newRole,
        });
    };

    // Submit when data is ready
    useEffect(() => {
        if (data.userId && data.roles) {
            put(`/users/${data.userId}`, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Role updated successfully');
                    setData({ userId: 0, name: '', email: '', roles: '' });
                },
                onError: () => {
                    toast.error('Failed to update role');
                },
            });
        }
    }, [data.userId, data.roles]);

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash?.success, flash?.error]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />

            {/* Page Header */}
            <div className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Users</h1>
                    <p className="text-muted-foreground text-sm">Manage user accounts and role assignments</p>
                </div>
                <Button asChild size="default" className="w-full sm:w-auto">
                    <Link href="/users/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                    </Link>
                </Button>
            </div>

            {/* Search */}
            <div className="px-4 pb-4 sm:px-6">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                        type="text"
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 pl-9 sm:h-9"
                        aria-label="Search users by name"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <Card className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[180px]">Name</TableHead>
                                    <TableHead className="hidden min-w-[200px] sm:table-cell">Email</TableHead>
                                    <TableHead className="min-w-[140px]">Role</TableHead>
                                    <TableHead className="hidden min-w-[100px] md:table-cell">Joined</TableHead>
                                    <TableHead className="w-[70px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32">
                                            <Empty className="border-0">
                                                <EmptyHeader>
                                                    <EmptyMedia variant="icon">
                                                        <Users className="h-6 w-6" />
                                                    </EmptyMedia>
                                                    <EmptyTitle>No users found</EmptyTitle>
                                                    <EmptyDescription>
                                                        {searchQuery ? (
                                                            <>
                                                                No users match your search.{' '}
                                                                <button
                                                                    onClick={() => setSearchQuery('')}
                                                                    className="text-primary underline underline-offset-4"
                                                                >
                                                                    Clear search
                                                                </button>
                                                            </>
                                                        ) : (
                                                            'Get started by adding a new user.'
                                                        )}
                                                    </EmptyDescription>
                                                </EmptyHeader>
                                            </Empty>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <UserInfo user={{ ...user, email_verified_at: '', created_at: '', updated_at: '', phone: '' }} />
                                                    {/* Show email on mobile below name */}
                                                    <span className="text-muted-foreground mt-1 text-xs sm:hidden">{user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={user.roles[0]?.id.toString()}
                                                    onValueChange={(value) => handleRoleChange(user, value)}
                                                    disabled={processing && data.userId === user.id}
                                                >
                                                    <SelectTrigger className="h-9 w-full max-w-[160px] min-w-[120px]">
                                                        {processing && data.userId === user.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <SelectValue placeholder="Select Role" />
                                                        )}
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
                                            <TableCell className="hidden md:table-cell">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                                                            <Link href={`/users/edit/${user.id}`}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Edit user</TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* Role Change Confirmation Dialog */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change User Role</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change <strong>{confirmDialog.userName}</strong>'s role to{' '}
                            <strong>{confirmDialog.newRoleName}</strong>? This will affect their permissions immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRoleChange}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

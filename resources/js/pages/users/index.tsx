import InputSearch from '@/components/inputSearch';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Loader2, Pencil, Plus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Users', href: '/users' }];

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

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name" />
                    </div>
                    <Link href="/users/create">
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add User
                        </Button>
                    </Link>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredUsers.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {searchQuery ? `No users match "${searchQuery}"` : 'No users found.'}
                        </div>
                    ) : (
                        filteredUsers.map((user) => (
                            <div key={user.id} className="rounded-lg border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <UserInfo user={{ ...user, email_verified_at: '', created_at: '', updated_at: '', phone: '' }} showEmail />
                                    </div>
                                    <Link href={`/users/edit/${user.id}`}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <Select
                                        value={user.roles[0]?.id.toString()}
                                        onValueChange={(value) => handleRoleChange(user, value)}
                                        disabled={processing && data.userId === user.id}
                                    >
                                        <SelectTrigger className="h-8 w-[140px]">
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
                                    <span className="text-muted-foreground text-[11px]">
                                        Joined {new Date(user.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3">Name</TableHead>
                                <TableHead className="px-3">Email</TableHead>
                                <TableHead className="px-3">Role</TableHead>
                                <TableHead className="px-3">Joined</TableHead>
                                <TableHead className="w-[70px] px-3 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <Users className="h-8 w-8 opacity-40" />
                                            <p>No users found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="px-3">
                                            <div className="flex items-center gap-2">
                                                <UserInfo user={{ ...user, email_verified_at: '', created_at: '', updated_at: '', phone: '' }} />
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3">{user.email}</TableCell>
                                        <TableCell className="px-3">
                                            <Select
                                                value={user.roles[0]?.id.toString()}
                                                onValueChange={(value) => handleRoleChange(user, value)}
                                                disabled={processing && data.userId === user.id}
                                            >
                                                <SelectTrigger className="h-8 w-[140px]">
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
                                        <TableCell className="px-3">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="px-3 text-right">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
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

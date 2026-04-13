import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Users', href: '/users' }];

type Permission = {
    id: number;
    name: string;
};

type User = {
    id: number;
    name: string;
    position: string | null;
    email: string;
    avatar?: string;
    created_at: string;
    disabled_at: string | null;
    roles: {
        permissions: Permission[];
        id: number;
        name: string;
    }[];
};

export default function UsersIndex() {
    const { users, flash, filters } = usePage<{
        users: User[];
        flash: { success: string; error: string };
        filters: { show_disabled: boolean };
    }>().props;

    const getInitials = useInitials();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.position ?? '').toLowerCase().includes(q) ||
                u.roles.some((r) => r.name.toLowerCase().includes(q)),
        );
    }, [users, searchQuery]);

    const toggleShowDisabled = (checked: boolean) => {
        router.get('/users', checked ? { show_disabled: '1' } : {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    const disabledCount = users.filter((u) => u.disabled_at).length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                            type="text"
                            placeholder="Search by name, email, position, or role"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                        <Checkbox
                            checked={filters.show_disabled}
                            onCheckedChange={(checked) => toggleShowDisabled(checked === true)}
                        />
                        <span className="text-muted-foreground text-sm">
                            Show disabled{disabledCount > 0 && ` (${disabledCount})`}
                        </span>
                    </label>
                    <Button size="sm" className="gap-2 sm:ml-auto" asChild>
                        <Link href="/users/create">
                            <Plus className="h-4 w-4" />
                            Add User
                        </Link>
                    </Button>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="px-3">User</TableHead>
                                <TableHead className="hidden px-3 lg:table-cell">Position</TableHead>
                                <TableHead className="hidden px-3 md:table-cell">Role</TableHead>
                                <TableHead className="hidden px-3 lg:table-cell">Joined</TableHead>
                                <TableHead className="w-[70px] px-3 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-40 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <Users className="h-8 w-8 opacity-40" />
                                            <p className="text-sm">
                                                {searchQuery ? `No users match "${searchQuery}"` : 'No users found'}
                                            </p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => {
                                    const roleName = user.roles[0]?.name;
                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell className="px-3 py-2.5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 shrink-0">
                                                        <AvatarImage src={user.avatar} alt={user.name} />
                                                        <AvatarFallback className="bg-neutral-200 text-xs text-black dark:bg-neutral-700 dark:text-white">
                                                            {getInitials(user.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-medium">{user.name}</span>
                                                            {user.disabled_at && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                                                                >
                                                                    Disabled
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground truncate text-xs">
                                                            {user.email}
                                                            {user.position && <span className="lg:hidden"> · {user.position}</span>}
                                                        </p>
                                                        {/* Mobile-only: role below email */}
                                                        {roleName && (
                                                            <div className="mt-1.5 md:hidden">
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {roleName}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground hidden px-3 text-sm lg:table-cell">
                                                {user.position || <span className="text-muted-foreground/60">—</span>}
                                            </TableCell>
                                            <TableCell className="hidden px-3 md:table-cell">
                                                {roleName ? (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {roleName}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground hidden px-3 text-sm lg:table-cell">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </TableCell>
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
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}

import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type SharedData, type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { LogOut, Settings, Shield, ToggleLeft, UsersRound } from 'lucide-react';

interface UserMenuContentProps {
    user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const page = usePage<SharedData>().props;
    const { auth } = page;
    const permissions: string[] = (auth as any)?.permissions ?? [];

    const canManageUsers = permissions.includes('users.view');
    const canManageRoles = permissions.includes('admin.roles');
    const canManageFeatureFlags = permissions.includes('feature-flags.manage');

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem render={<Link className="block w-full" href={route('profile.edit')} as="button" prefetch onClick={cleanup} />}>
                    <Settings className="mr-2" />
                    Settings
                </DropdownMenuItem>
            </DropdownMenuGroup>
            {(canManageUsers || canManageRoles || canManageFeatureFlags) && (
                <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        {canManageUsers && (
                            <DropdownMenuItem render={<Link className="block w-full" href="/users" as="button" prefetch onClick={cleanup} />}>
                                <UsersRound className="mr-2" />
                                Users
                            </DropdownMenuItem>
                        )}
                        {canManageRoles && (
                            <DropdownMenuItem
                                render={<Link className="block w-full" href="/admin/roles" as="button" prefetch onClick={cleanup} />}
                            >
                                <Shield className="mr-2" />
                                Roles & Permissions
                            </DropdownMenuItem>
                        )}
                        {canManageFeatureFlags && (
                            <DropdownMenuItem
                                render={<Link className="block w-full" href="/admin/feature-flags" as="button" prefetch onClick={cleanup} />}
                            >
                                <ToggleLeft className="mr-2" />
                                Feature Flags
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link className="block w-full" method="post" href={route('logout')} as="button" onClick={cleanup} />}>
                <LogOut className="mr-2" />
                Log out
            </DropdownMenuItem>
        </>
    );
}

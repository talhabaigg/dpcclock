import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Key, LogOut, Phone, Settings, Shield, ToggleLeft, UsersRound } from 'lucide-react';

interface TokenStats {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    message_count: number;
    estimated_cost: number;
    limit: number;
    voice_minutes: number;
    voice_calls: number;
    voice_cost: number;
    total_cost: number;
}

function formatNumber(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

interface UserMenuContentProps {
    user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const page = usePage<SharedData & { tokenStats: TokenStats }>().props;
    const { auth } = page;
    const tokenStats: TokenStats | null = (page as any).tokenStats ?? null;
    const permissions: string[] = (auth as any)?.permissions ?? [];

    const canManageUsers = permissions.includes('users.view');
    const canManageRoles = permissions.includes('admin.roles');
    const canManageFeatureFlags = permissions.includes('feature-flags.manage');

    const aiPercent = tokenStats ? Math.min((tokenStats.total_tokens / tokenStats.limit) * 100, 100) : 0;
    const aiRemaining = tokenStats ? Math.max(tokenStats.limit - tokenStats.total_tokens, 0) : 0;
    const aiProgressColor = aiPercent >= 90 ? 'bg-red-500' : aiPercent >= 70 ? 'bg-amber-500' : 'bg-foreground/70';

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            {tokenStats && (
                <>
                    <DropdownMenuSeparator />
                    <div className="space-y-2 px-2 py-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">AI Usage</span>
                            <span className="text-muted-foreground text-[10px] tabular-nums">
                                {formatNumber(tokenStats.total_tokens)} / {formatNumber(tokenStats.limit)}
                            </span>
                        </div>
                        <div className="bg-muted relative h-1 w-full overflow-hidden rounded-full">
                            <div className={cn('h-full transition-all duration-500', aiProgressColor)} style={{ width: `${aiPercent}%` }} />
                        </div>
                        <div className="text-muted-foreground flex items-center justify-between text-[10px] tabular-nums">
                            <span>
                                {aiPercent.toFixed(0)}% used · {formatNumber(aiRemaining)} left
                            </span>
                            <span>${tokenStats.total_cost.toFixed(4)}</span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-3 text-[10px] tabular-nums">
                            <span className="flex items-center gap-1">
                                <ArrowUp className="size-3" />
                                {formatNumber(tokenStats.input_tokens)} in
                            </span>
                            <span className="flex items-center gap-1">
                                <ArrowDown className="size-3" />
                                {formatNumber(tokenStats.output_tokens)} out
                            </span>
                            {(tokenStats.voice_calls > 0 || tokenStats.voice_minutes > 0) && (
                                <span className="flex items-center gap-1">
                                    <Phone className="size-3" />
                                    {tokenStats.voice_minutes.toFixed(1)}m
                                </span>
                            )}
                        </div>
                    </div>
                </>
            )}
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
                            <>
                                <DropdownMenuItem
                                    render={<Link className="block w-full" href="/admin/roles" as="button" prefetch onClick={cleanup} />}
                                >
                                    <Shield className="mr-2" />
                                    Roles & Permissions
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    render={<Link className="block w-full" href="/admin/permissions" as="button" prefetch onClick={cleanup} />}
                                >
                                    <Key className="mr-2" />
                                    All Permissions
                                </DropdownMenuItem>
                            </>
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

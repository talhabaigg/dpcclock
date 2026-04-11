import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { cn } from '@/lib/utils';
import { type SharedData, type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Coins, Key, LogOut, Phone, Settings, Shield, Sparkles, TrendingUp, UsersRound } from 'lucide-react';

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

    const aiPercent = tokenStats ? Math.min((tokenStats.total_tokens / tokenStats.limit) * 100, 100) : 0;
    const aiRemaining = tokenStats ? Math.max(tokenStats.limit - tokenStats.total_tokens, 0) : 0;
    const aiProgressColor = aiPercent >= 90 ? 'bg-red-500' : aiPercent >= 70 ? 'bg-yellow-500' : 'bg-emerald-500';

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
                    <div className="px-2 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="text-muted-foreground size-3.5" />
                                <span className="text-xs font-medium">AI Usage</span>
                            </div>
                            <span className="text-muted-foreground text-[10px]">{formatNumber(tokenStats.total_tokens)} / {formatNumber(tokenStats.limit)}</span>
                        </div>
                        <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
                            <div className={cn('h-full transition-all duration-500', aiProgressColor)} style={{ width: `${aiPercent}%` }} />
                        </div>
                        <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                            <span>{aiPercent.toFixed(1)}% used</span>
                            <span>{formatNumber(aiRemaining)} remaining</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="bg-muted/50 rounded-md px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="size-3 text-blue-500" />
                                    <span className="text-muted-foreground text-[10px]">Input</span>
                                </div>
                                <p className="text-xs font-medium">{formatNumber(tokenStats.input_tokens)}</p>
                            </div>
                            <div className="bg-muted/50 rounded-md px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="size-3 rotate-180 text-purple-500" />
                                    <span className="text-muted-foreground text-[10px]">Output</span>
                                </div>
                                <p className="text-xs font-medium">{formatNumber(tokenStats.output_tokens)}</p>
                            </div>
                        </div>
                        {(tokenStats.voice_calls > 0 || tokenStats.voice_minutes > 0) && (
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                <div className="bg-muted/50 rounded-md px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                        <Phone className="size-3 text-green-500" />
                                        <span className="text-muted-foreground text-[10px]">Calls</span>
                                    </div>
                                    <p className="text-xs font-medium">{tokenStats.voice_calls}</p>
                                </div>
                                <div className="bg-muted/50 rounded-md px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                        <Phone className="size-3 text-green-500" />
                                        <span className="text-muted-foreground text-[10px]">Minutes</span>
                                    </div>
                                    <p className="text-xs font-medium">{tokenStats.voice_minutes.toFixed(1)}</p>
                                </div>
                            </div>
                        )}
                        <div className="mt-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                <Coins className="size-3 text-amber-500" />
                                <span className="text-muted-foreground text-[10px]">Total Cost</span>
                            </div>
                            <span className="text-xs font-medium text-amber-600">${tokenStats.total_cost.toFixed(4)}</span>
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
            {(canManageUsers || canManageRoles) && (
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
                                <DropdownMenuItem render={<Link className="block w-full" href="/admin/roles" as="button" prefetch onClick={cleanup} />}>
                                    <Shield className="mr-2" />
                                    Roles & Permissions
                                </DropdownMenuItem>
                                <DropdownMenuItem render={<Link className="block w-full" href="/admin/permissions" as="button" prefetch onClick={cleanup} />}>
                                    <Key className="mr-2" />
                                    All Permissions
                                </DropdownMenuItem>
                            </>
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

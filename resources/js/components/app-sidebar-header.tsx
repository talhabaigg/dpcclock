import { Breadcrumbs } from '@/components/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Bell, BellOff, CheckCheck, Inbox } from 'lucide-react';
import { useMemo } from 'react';
import AppNotificationDisplay from './app-notification-display';
import { Button } from './ui/button';

interface InboxItem {
    id: number;
    form_name: string;
    assignee_strategy: 'user' | 'permission' | null;
    created_at: string;
    expires_at: string | null;
    context_label: string | null;
    context_type: string | null;
    url: string;
}

interface InboxData {
    count: number;
    items: InboxItem[];
}

interface InboxGroup {
    name: string;
    items: InboxItem[];
}

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const props = usePage().props as any;
    const notifications = props.notifications;
    const hasUnread = notifications.unreadCount > 0;
    const inbox: InboxData = props.inbox ?? { count: 0, items: [] };
    const hasInbox = inbox.count > 0;

    // One group per source type today ("Forms"); leaves the door open for
    // "Signatures", "Toolbox Talks" etc. without restructuring the UI.
    const inboxGroups = useMemo<InboxGroup[]>(() => {
        if (inbox.items.length === 0) return [];
        return [{ name: 'Forms', items: inbox.items }];
    }, [inbox.items]);

    return (
        <header className="border-sidebar-border/50 flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <div className="ml-auto flex items-center gap-1">
                <Sheet>
                    <SheetTrigger className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative rounded-lg p-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                        <Inbox className="text-muted-foreground h-5 w-5" />
                        {hasInbox && (
                            <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                                {inbox.count > 99 ? '99+' : inbox.count}
                            </span>
                        )}
                    </SheetTrigger>
                    <SheetContent className="flex flex-col gap-0 p-0">
                        <SheetHeader className="border-b px-4 pr-12 py-4">
                            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                                Inbox
                                {hasInbox && (
                                    <span className="text-muted-foreground text-xs font-normal">
                                        ({inbox.count > 99 ? '99+' : inbox.count} to action)
                                    </span>
                                )}
                            </SheetTitle>
                            <SheetDescription>Items awaiting your action.</SheetDescription>
                        </SheetHeader>

                        {!hasInbox ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
                                <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                                    <Inbox className="text-muted-foreground/60 h-7 w-7" />
                                </div>
                                <div className="text-center">
                                    <p className="text-foreground text-sm font-medium">Inbox zero</p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        Nothing waiting on you right now.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-5">
                                    {inboxGroups.map((group) => (
                                        <section key={group.name}>
                                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                                                <h3 className="text-muted-foreground truncate text-xs font-normal">
                                                    {group.name}
                                                </h3>
                                                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                                                    {group.items.length}
                                                </span>
                                            </div>
                                            <ul className="divide-border/50 divide-y">
                                                {group.items.map((item) => {
                                                    const context = item.context_label || item.context_type;
                                                    return (
                                                        <li key={item.id} className="py-1">
                                                            <Link
                                                                href={item.url}
                                                                className="hover:bg-accent group flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
                                                            >
                                                                <span className="min-w-0 flex-1 truncate text-xs">
                                                                    {context ? (
                                                                        <>
                                                                            <span className="text-foreground">{context}</span>
                                                                            <span className="text-muted-foreground"> — {item.form_name}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-foreground">{item.form_name}</span>
                                                                    )}
                                                                </span>
                                                                {item.assignee_strategy === 'permission' && (
                                                                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                                                                        Permission
                                                                    </Badge>
                                                                )}
                                                                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                                                                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                                </span>
                                                                <ArrowRight className="text-muted-foreground/50 group-hover:text-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                <Sheet>
                    <SheetTrigger className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative rounded-lg p-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                        <Bell className="text-muted-foreground h-5 w-5" />

                        {hasUnread && (
                            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500">
                                <span className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-75" />
                            </span>
                        )}
                    </SheetTrigger>
                    <SheetContent className="flex flex-col gap-0 p-0">
                        <SheetHeader className="border-b px-4 pr-12 py-4">
                            <div className="flex items-center justify-between">
                                <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                                    Notifications
                                    {notifications?.unreadCount > 0 && (
                                        <span className="text-xs font-normal text-muted-foreground">
                                            ({notifications.unreadCount > 99 ? '99+' : notifications.unreadCount} unread)
                                        </span>
                                    )}
                                </SheetTitle>
                                {notifications.latest.length > 0 && (
                                    <Link href={route('notifications.markAllRead')}>
                                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs">
                                            <CheckCheck className="h-3.5 w-3.5" />
                                            Mark all read
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </SheetHeader>

                        {notifications.latest.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                    <BellOff className="h-7 w-7 text-muted-foreground/60" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-foreground">All caught up</p>
                                    <p className="text-muted-foreground mt-1 text-xs">New notifications will appear here when they arrive.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4">
                                <AppNotificationDisplay notifications={notifications.latest} />
                            </div>
                        )}
                    </SheetContent>
                </Sheet>
            </div>
        </header>
    );
}

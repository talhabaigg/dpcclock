import { Breadcrumbs } from '@/components/breadcrumbs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import AppNotificationDisplay from './app-notification-display';
import { Button } from './ui/button';
export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const props = usePage().props as any;
    const notifications = props.notifications;
    const hasUnread = notifications.unreadCount > 0;
    return (
        <header className="border-sidebar-border/50 flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <Sheet>
                <SheetTrigger className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative ml-auto rounded-lg p-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                    <Bell className="h-5 w-5 text-muted-foreground" />

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
        </header>
    );
}

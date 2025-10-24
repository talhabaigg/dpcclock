import { Breadcrumbs } from '@/components/breadcrumbs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { usePage } from '@inertiajs/react';
import { Bell, Trash } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardTitle } from './ui/card';
export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const props = usePage().props as any;
    const notifications = props.notifications;
    console.log(notifications);
    const displayCount = notifications.unreadCount > 99 ? '99+' : notifications.unreadCount > 0 ? notifications.unreadCount.toString() : null;
    return (
        <header className="border-sidebar-border/50 flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <Sheet>
                <SheetTrigger className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative ml-auto rounded-md p-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                    <Bell className="h-5 w-5" />

                    {displayCount && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white">
                            {displayCount}
                        </span>
                    )}
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
                            Notifications
                            {notifications?.unreadCount > 0 && (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] leading-none font-medium text-white">
                                    {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
                                </span>
                            )}
                        </SheetTitle>
                        <SheetDescription>All your notifications will appear here.</SheetDescription>
                    </SheetHeader>

                    {notifications.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">No new notifications</p>
                    ) : (
                        <ul>
                            {notifications.latest.map((notification) => (
                                <Card key={notification.id} className="mx-2 mt-2 border-b px-4 py-2 last:border-2">
                                    <CardTitle className="flex items-center">
                                        {notification.data.type}{' '}
                                        <Button className="ml-auto" variant="outline">
                                            <Trash />
                                        </Button>
                                    </CardTitle>
                                    <CardContent>{notification.data.message}</CardContent>
                                    <div className="flex items-center justify-between">
                                        <Badge>{notification.data.status}</Badge>
                                        <p className="text-xs">{new Date(notification.created_at).toLocaleString()}</p>
                                    </div>
                                </Card>
                            ))}
                        </ul>
                    )}
                </SheetContent>
            </Sheet>
        </header>
    );
}

import { Breadcrumbs } from '@/components/breadcrumbs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Bell } from 'lucide-react';
export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    return (
        <header className="border-sidebar-border/50 flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <Sheet>
                <SheetTrigger className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-accent-foreground ml-auto rounded-md p-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none">
                    <Bell className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Notifications</SheetTitle>
                        <SheetDescription>All your notifications will appear here.</SheetDescription>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
        </header>
    );
}

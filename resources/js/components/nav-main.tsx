import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useFavorites } from '@/hooks/use-favorites';
import { isNavItemActive } from '@/lib/utils';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Pin } from 'lucide-react';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    const { isFavorite, toggleFavorite } = useFavorites();
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isNavItemActive(item.href, page.url)} tooltip={{ children: item.title }}>
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                            showOnHover={!isFavorite(item.href)}
                            onClick={() => toggleFavorite(item.href)}
                            className="text-sidebar-foreground/50 hover:text-sidebar-foreground"
                        >
                            <Pin className={isFavorite(item.href) ? 'fill-current' : ''} />
                            <span className="sr-only">Toggle pin</span>
                        </SidebarMenuAction>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

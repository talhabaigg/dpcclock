import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useFavorites } from '@/hooks/use-favorites';
import { isNavItemActive } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { type LucideIcon, Pin } from 'lucide-react';

export type FavoriteEntry = {
    title: string;
    url: string;
    icon: LucideIcon;
};

export function NavFavorites({ allItems }: { allItems: FavoriteEntry[] }) {
    const page = usePage();
    const { favorites, toggleFavorite } = useFavorites();

    const itemMap = new Map(allItems.map((item) => [item.url, item]));
    const favoriteItems = favorites.map((url) => itemMap.get(url)).filter(Boolean) as FavoriteEntry[];

    if (favoriteItems.length === 0) return null;

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarMenu>
                {favoriteItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton render={<Link href={item.url} prefetch />} isActive={isNavItemActive(item.url, page.url)} tooltip={{ children: item.title }}>
                            <item.icon />
                            <span>{item.title}</span>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                            onClick={() => toggleFavorite(item.url)}
                            className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        >
                            <Pin className="fill-current" />
                            <span className="sr-only">Unpin</span>
                        </SidebarMenuAction>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

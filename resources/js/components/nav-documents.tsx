'use client';

import { MoreHorizontalIcon, type LucideIcon } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { SidebarGroup, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

import { usePage } from '@inertiajs/react';

export function NavDocuments({
    items,
}: {
    items: {
        name: string;
        url?: string;
        icon: LucideIcon;
        subItems?: {
            name: string;
            url: string;
            icon: LucideIcon;
            permission?: string;
        }[];
    }[];
}) {
    const { isMobile } = useSidebar();
    const page = usePage();

    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={item.url === page.url}>
                            <a href={item.url || '#'}>
                                <item.icon />
                                <span>{item.name}</span>
                            </a>
                        </SidebarMenuButton>

                        {item.subItems && item.subItems.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuAction showOnHover className="data-[state=open]:bg-accent rounded-sm">
                                        <MoreHorizontalIcon />
                                        <span className="sr-only">More</span>
                                    </SidebarMenuAction>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-40 rounded-lg"
                                    side={isMobile ? 'bottom' : 'right'}
                                    align={isMobile ? 'end' : 'start'}
                                >
                                    {item.subItems.map((sub) => (
                                        <DropdownMenuItem key={sub.name} asChild>
                                            <a href={sub.url} className="flex items-center gap-2">
                                                <sub.icon className="h-4 w-4" />
                                                <span>{sub.name}</span>
                                            </a>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';

import { Link, usePage } from '@inertiajs/react';

const STORAGE_KEY = 'navDocumentsCollapsibleState';

type NavItem = {
    name: string;
    url?: string;
    icon: LucideIcon;
    subItems?: {
        name: string;
        url: string;
        icon: LucideIcon;
        permission?: string;
    }[];
};

type CollapseState = Record<string, boolean>;

function loadCollapseState(): CollapseState {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveCollapseState(state: CollapseState) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
}

export function NavDocuments({ items }: { items: NavItem[] }) {
    const page = usePage();

    const [openMap, setOpenMap] = useState<CollapseState>(() => loadCollapseState());

    const handleOpenChange = (name: string, open: boolean) => {
        setOpenMap((prev) => {
            const next = { ...prev, [name]: open };
            saveCollapseState(next);
            return next;
        });
    };

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarMenu>
                {items.map((item) => {
                    const isOpen = openMap[item.name] ?? true; // default to open first time

                    return (
                        <Collapsible key={item.name} asChild open={isOpen} onOpenChange={(open) => handleOpenChange(item.name, open)}>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={item.name}>
                                    {/* you can switch this to <Link> if you want Inertia navigation */}
                                    <a href={item.url}>
                                        <item.icon />
                                        <span>{item.name}</span>
                                    </a>
                                </SidebarMenuButton>

                                {item.subItems?.length ? (
                                    <>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuAction className="data-[state=open]:rotate-90">
                                                <ChevronRight />
                                                <span className="sr-only">Toggle</span>
                                            </SidebarMenuAction>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {item.subItems.map((subItem) => (
                                                    <SidebarMenuSubItem key={subItem.name}>
                                                        <SidebarMenuSubButton asChild isActive={subItem.url === page.url}>
                                                            <Link href={subItem.url}>
                                                                <span>{subItem.name}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </>
                                ) : null}
                            </SidebarMenuItem>
                        </Collapsible>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

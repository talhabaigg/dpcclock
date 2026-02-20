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

type SubItem = {
    name: string;
    url: string;
    icon: LucideIcon;
    permission?: string;
};

type NavItem = {
    name: string;
    url?: string;
    icon: LucideIcon;
    groupByAlpha?: boolean;
    subItems?: SubItem[];
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

function renderGroupedSubItems(subItems: SubItem[], currentUrl: string) {
    const sorted = [...subItems].sort((a, b) => a.name.localeCompare(b.name));
    const groups: { letter: string; items: SubItem[] }[] = [];

    for (const item of sorted) {
        const letter = item.name[0].toUpperCase();
        const last = groups[groups.length - 1];
        if (last && last.letter === letter) {
            last.items.push(item);
        } else {
            groups.push({ letter, items: [item] });
        }
    }

    return groups.map((group, groupIndex) => (
        <div key={group.letter}>
            {groupIndex > 0 && <hr className="border-sidebar-border my-1" />}
            {group.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.name}>
                    <SidebarMenuSubButton asChild isActive={subItem.url === currentUrl}>
                        <Link href={subItem.url}>
                            <span>{subItem.name}</span>
                        </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
            ))}
        </div>
    ));
}

export function NavDocuments({ items, permissions = [] }: { items: NavItem[]; permissions?: string[] }) {
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
                    const visibleSubItems = item.subItems?.filter(
                        (sub) => !sub.permission || permissions.includes(sub.permission),
                    );

                    return (
                        <Collapsible key={item.name} asChild open={isOpen} onOpenChange={(open) => handleOpenChange(item.name, open)}>
                            <SidebarMenuItem>
                                <SidebarMenuButton tooltip={item.name}>
                                    <item.icon />
                                    <span>{item.name}</span>
                                </SidebarMenuButton>

                                {visibleSubItems?.length ? (
                                    <>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuAction className="data-[state=open]:rotate-90">
                                                <ChevronRight />
                                                <span className="sr-only">Toggle</span>
                                            </SidebarMenuAction>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {item.groupByAlpha
                                                    ? renderGroupedSubItems(visibleSubItems, page.url)
                                                    : visibleSubItems.map((subItem) => (
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

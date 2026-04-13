import { ChevronRight, Pin, type LucideIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';

import { useFavorites } from '@/hooks/use-favorites';
import { isNavItemActive } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';

const LONG_PRESS_DURATION = 500;

function useLongPress(onLongPress: () => void) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);
    const [pressing, setPressing] = useState(false);

    const onTouchStart = useCallback(() => {
        didLongPress.current = false;
        setPressing(true);
        timerRef.current = setTimeout(() => {
            didLongPress.current = true;
            setPressing(false);
            onLongPress();
        }, LONG_PRESS_DURATION);
    }, [onLongPress]);

    const cancel = useCallback(() => {
        setPressing(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onClick = useCallback((e: React.MouseEvent) => {
        if (didLongPress.current) {
            e.preventDefault();
            didLongPress.current = false;
        }
    }, []);

    return { onTouchStart, onTouchEnd: cancel, onTouchMove: cancel, onClick, pressing };
}

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

function groupAlpha(subItems: SubItem[]): { letter: string; items: SubItem[] }[] {
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
    return groups;
}

function FavoriteButton({ url, isFavorite, toggleFavorite }: { url: string; isFavorite: (url: string) => boolean; toggleFavorite: (url: string) => void }) {
    const fav = isFavorite(url);
    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(url);
            }}
            className={`ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/menu-sub-item:opacity-100 hover:text-sidebar-foreground ${fav ? 'text-sidebar-foreground/70 opacity-100' : 'text-sidebar-foreground/40'}`}
        >
            <Pin className={`size-3 ${fav ? 'fill-current' : ''}`} />
        </button>
    );
}

function LongPressSubItem({ subItem, currentUrl, isFavorite, toggleFavorite }: { subItem: SubItem; currentUrl: string; isFavorite: (url: string) => boolean; toggleFavorite: (url: string) => void }) {
    const [showPinFlash, setShowPinFlash] = useState(false);
    const { pressing, ...longPressHandlers } = useLongPress(
        useCallback(() => {
            toggleFavorite(subItem.url);
            setShowPinFlash(true);
            setTimeout(() => setShowPinFlash(false), 800);
        }, [subItem.url, toggleFavorite]),
    );

    const fav = isFavorite(subItem.url);
    const showPin = pressing || showPinFlash;

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton
                render={<Link href={subItem.url} prefetch {...longPressHandlers} />}
                isActive={isNavItemActive(subItem.url, currentUrl)}
            >
                <span className="truncate">{subItem.name}</span>
                {showPin && (
                    <Pin className={`ml-auto size-3 shrink-0 ${pressing ? 'animate-pulse' : ''} ${fav ? 'fill-current text-sidebar-foreground/70' : 'text-sidebar-foreground/40'}`} />
                )}
                <FavoriteButton url={subItem.url} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}

function renderGroupedSubItems(subItems: SubItem[], currentUrl: string, isFavorite: (url: string) => boolean, toggleFavorite: (url: string) => void) {
    return groupAlpha(subItems).map((group, groupIndex) => (
        <div key={group.letter}>
            {groupIndex > 0 && <hr className="border-sidebar-border my-1" />}
            {group.items.map((subItem) => (
                <LongPressSubItem key={subItem.name} subItem={subItem} currentUrl={currentUrl} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
            ))}
        </div>
    ));
}

function renderDropdownSubItems(subItems: SubItem[], groupByAlpha: boolean, currentUrl: string, isFavorite: (url: string) => boolean, toggleFavorite: (url: string) => void) {
    if (!groupByAlpha) {
        return subItems.map((subItem) => (
            <DropdownMenuItem key={subItem.name} render={<Link href={subItem.url} prefetch />} className={isNavItemActive(subItem.url, currentUrl) ? 'bg-accent' : ''}>
                    <subItem.icon className="mr-2 size-4 shrink-0" />
                    {subItem.name}
                    <FavoriteButton url={subItem.url} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
            </DropdownMenuItem>
        ));
    }

    return groupAlpha(subItems).map((group, groupIndex) => (
        <div key={group.letter}>
            {groupIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="px-2 py-1 text-[10px] text-muted-foreground">{group.letter}</DropdownMenuLabel>
            {group.items.map((subItem) => (
                <DropdownMenuItem key={subItem.name} render={<Link href={subItem.url} prefetch />} className={isNavItemActive(subItem.url, currentUrl) ? 'bg-accent' : ''}>
                    <subItem.icon className="mr-2 size-4 shrink-0" />
                    {subItem.name}
                    <FavoriteButton url={subItem.url} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
                </DropdownMenuItem>
            ))}
        </div>
    ));
}

export function NavDocuments({ items, permissions = [] }: { items: NavItem[]; permissions?: string[] }) {
    const page = usePage();
    const { state, isMobile } = useSidebar();
    const isCollapsed = state === 'collapsed' && !isMobile;
    const { isFavorite, toggleFavorite } = useFavorites();

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
                    const visibleSubItems = item.subItems?.filter(
                        (sub) => !sub.permission || permissions.includes(sub.permission),
                    );
                    const hasActiveChild = visibleSubItems?.some((sub) => isNavItemActive(sub.url, page.url)) ?? false;
                    const isOpen = openMap[item.name] ?? false;

                    // Collapsed sidebar: show dropdown flyout so sub-items are still reachable
                    if (isCollapsed && visibleSubItems?.length) {
                        return (
                            <SidebarMenuItem key={item.name}>
                                <DropdownMenu>
                                    <SidebarMenuButton render={<DropdownMenuTrigger />} tooltip={item.name} className={hasActiveChild ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}>
                                            <item.icon />
                                            <span>{item.name}</span>
                                    </SidebarMenuButton>
                                    <DropdownMenuContent side="right" align="start" className="min-w-48 max-h-96 overflow-y-auto">
                                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">{item.name}</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {renderDropdownSubItems(visibleSubItems, item.groupByAlpha ?? false, page.url, isFavorite, toggleFavorite)}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        );
                    }

                    // Expanded sidebar: standard collapsible
                    return (
                        <SidebarMenuItem key={item.name}>
                            <Collapsible open={isOpen} onOpenChange={(open) => handleOpenChange(item.name, open)}>
                                <SidebarMenuButton tooltip={item.name}>
                                    <item.icon />
                                    <span>{item.name}</span>
                                </SidebarMenuButton>

                                {visibleSubItems?.length ? (
                                    <>
                                        <SidebarMenuAction render={<CollapsibleTrigger />} className="data-[panel-open]:rotate-90">
                                            <ChevronRight />
                                            <span className="sr-only">Toggle</span>
                                        </SidebarMenuAction>

                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {item.groupByAlpha
                                                    ? renderGroupedSubItems(visibleSubItems, page.url, isFavorite, toggleFavorite)
                                                    : visibleSubItems.map((subItem) => (
                                                          <LongPressSubItem key={subItem.name} subItem={subItem} currentUrl={page.url} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
                                                      ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </>
                                ) : null}
                            </Collapsible>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

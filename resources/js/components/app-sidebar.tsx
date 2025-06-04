import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Binary, Box, Building, Clock, Database, Folder, FoldHorizontal, Hammer, Hourglass, LayoutGrid, Pickaxe, UsersRound } from 'lucide-react';
import AppLogo from './app-logo';
import { NavDocuments } from './nav-documents';
const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        permission: 'view dashboard',
    },
    {
        title: 'Locations',
        href: '/locations',
        icon: Building,
        permission: 'manage locations',
    },
    {
        title: 'Employees',
        href: '/employees',
        icon: UsersRound,
        permission: 'manage employees',
    },
    {
        title: 'Kiosks',
        href: '/kiosks',
        icon: Clock,
        permission: 'view kiosk',
    },
    {
        title: 'Worktypes',
        href: '/worktypes',
        icon: Hammer,
        permission: 'manage worktypes',
    },
    {
        title: 'Timesheets',
        href: '/timesheets',
        icon: Hourglass,
        permission: 'manage timesheets',
    },

    {
        title: 'Timesheet Converter',
        href: '/timesheets-converter',
        icon: FoldHorizontal,
        permission: 'view timesheet converter',
    },
    {
        title: 'Users',
        href: '/users',
        icon: UsersRound,
        permission: 'view timesheet converter',
    },
    {
        title: 'Requisitions',
        href: '/requisition/all',
        icon: Folder,
        permission: 'view all requisitions',
    },
];

// const textIcon = (text: string) => () => (
//     <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-500 text-sm font-medium text-white">{text}</span>
// );
const documents = [
    {
        name: 'Data',
        icon: Database,
        permission: 'view all requisitions',
        subItems: [
            {
                name: 'Material',
                url: '/material-items/all',
                icon: Pickaxe,
                permission: 'view all requisitions',
            },
            {
                name: 'Suppliers',
                url: '/suppliers',
                icon: Box,
                permission: 'view all requisitions',
            },
            {
                name: 'Cost Codes',
                url: '/cost-codes',
                icon: Binary,
                permission: 'view all requisitions',
            },
        ],
    },
];

const footerNavItems: NavItem[] = [
    // {
    //     title: 'Repository',
    //     href: 'https://github.com/laravel/react-starter-kit',
    //     icon: Folder,
    // },
    // {
    //     title: 'Documentation',
    //     href: 'https://laravel.com/docs/starter-kits',
    //     icon: BookOpen,
    // },
];

type AuthUser = {
    permissions: string[];
    // add other user properties if needed
};

type PageProps = {
    auth: {
        user: AuthUser;
        permissions: string[];
        // add other auth properties if needed
    };
    // add other props if needed
};

export function AppSidebar() {
    const { props } = usePage<PageProps>();
    // const permissions: string[] = props?.auth?.user?.permissions ?? [];
    const permissions: string[] = props?.auth?.permissions ?? [];

    const filteredMainNavItems = mainNavItems.filter((item) => !item.permission || permissions.includes(item.permission));
    const filteredDocuments = documents.filter((item) => !item.permission || permissions.includes(item.permission));
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={filteredMainNavItems} />
                <NavDocuments items={filteredDocuments} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

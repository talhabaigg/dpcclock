import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TokenUsageWidget } from '@/components/token-usage-widget';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    Binary,
    Box,
    Building,
    CalendarDays,
    ChartArea,
    ChartLine,
    Clock,
    Database,
    File,
    FileSpreadsheet,
    Folder,
    Hammer,
    Hourglass,
    LayoutGrid,
    Pickaxe,
    Target,
    UsersRound,
} from 'lucide-react';
import AppLogo from './app-logo';
import { NavDocuments } from './nav-documents';
const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/',
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
        title: 'Turnover Forecast',
        href: '/turnover-forecast',
        icon: ChartLine,
        permission: 'view all requisitions',
    },
    {
        title: 'Cashflow Forecast',
        href: '/cash-forecast',
        icon: ChartArea,
        permission: 'view all requisitions',
    },
    {
        title: 'Budget Management',
        href: '/budget-management',
        icon: Target,
        adminOnly: true,
        permission: null,
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
    // {
    //     title: 'Timesheets',
    //     href: '/timesheets',
    //     icon: Hourglass,
    //     permission: 'manage timesheets',
    // },

    // {
    //     title: 'Timesheet Converter',
    //     href: '/timesheets-converter',
    //     icon: FoldHorizontal,
    //     permission: 'view timesheet converter',
    // },
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
        permission: 'manage timesheets',
    },
    {
        title: 'Variations',
        href: '/variations',
        icon: File,
        permission: 'view timesheet converter',
    },
];

// const textIcon = (text: string) => () => (
//     <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-500 text-sm font-medium text-white">{text}</span>
// );

const timesheets = [
    {
        name: 'Timesheets',
        icon: Clock,
        permission: 'manage timesheets',
        subItems: [
            {
                name: 'Manage',
                url: '/timesheets',
                icon: Hourglass,
                permission: 'view all requisitions',
            },
            {
                name: 'Review',
                url: '/timesheets/review',
                icon: Hourglass,
                permission: 'view all requisitions',
            },
        ],
    },
];
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
            {
                name: 'Cost Types',
                url: '/cost-types',
                icon: Binary,
                permission: 'view all requisitions',
            },
        ],
    },
];

const reports = [
    {
        name: 'Reports',
        icon: FileSpreadsheet,
        permission: 'view all requisitions',
        subItems: [
            {
                name: 'Req Line Desc Report',
                url: '/reports/req-line-items-desc',
                icon: Pickaxe,
                permission: 'view all requisitions',
            },
        ],
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Queue Status',
        href: '/queue-status',
        icon: Activity,
        permission: 'view all requisitions',
    },
    {
        title: 'Calendar',
        href: '/calendar',
        icon: CalendarDays,
        permission: 'view all requisitions',
    },
    // {
    //     title: 'Documentation',
    //     href: 'https://laravel.com/docs/starter-kits',
    //     icon: BookOpen,
    //     permission: 'view all requisitions',
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
        isAdmin: boolean;
        // add other auth properties if needed
    };
    // add other props if needed
};

export function AppSidebar() {
    const { props } = usePage<PageProps>();
    // const permissions: string[] = props?.auth?.user?.permissions ?? [];
    const permissions: string[] = props?.auth?.permissions ?? [];
    const isAdmin = props?.auth?.isAdmin ?? false;

    const filteredMainNavItems = mainNavItems.filter((item) => {
        if (item.adminOnly && !isAdmin) {
            return false;
        }
        return !item.permission || permissions.includes(item.permission);
    });
    const filteredTimesheets = timesheets.filter((item) => !item.permission || permissions.includes(item.permission));
    const filteredDocuments = documents.filter((item) => !item.permission || permissions.includes(item.permission));
    const filteredReports = reports.filter((item) => !item.permission || permissions.includes(item.permission));
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
                <NavDocuments items={filteredTimesheets} />
                <NavDocuments items={filteredDocuments} />
                <NavDocuments items={filteredReports} />
            </SidebarContent>

            <SidebarFooter>
                <TokenUsageWidget className="mb-2" />
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

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
    DollarSign,
    File,
    FileSpreadsheet,
    Folder,
    FolderTree,
    GitCompare,
    Hammer,
    Hourglass,
    Key,
    LayoutGrid,
    PersonStanding,
    Pickaxe,
    RefreshCw,
    Settings,
    Shield,
    Target,
    UserX,
    UsersRound,
} from 'lucide-react';
import AppLogo from './app-logo';
import { NavDocuments } from './nav-documents';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/',
        icon: LayoutGrid,
        permission: 'dashboard.view',
    },
    {
        title: 'Locations',
        href: '/locations',
        icon: Building,
        permission: 'locations.view',
    },
    {
        title: 'Turnover Forecast',
        href: '/turnover-forecast',
        icon: ChartLine,
        permission: 'turnover-forecast.view',
    },
    {
        title: 'Labour Forecast',
        href: '/labour-forecast',
        icon: PersonStanding,
        permission: 'turnover-forecast.view',
    },
    {
        title: 'Cashflow Forecast',
        href: '/cash-forecast',
        icon: ChartArea,
        permission: 'cash-forecast.view',
    },
    {
        title: 'Budget Management',
        href: '/budget-management',
        icon: Target,
        permission: 'budget.view',
    },
    {
        title: 'Employees',
        href: '/employees',
        icon: UsersRound,
        permission: 'employees.view',
    },
    {
        title: 'Kiosks',
        href: '/kiosks',
        icon: Clock,
        permission: 'kiosks.view',
    },
    {
        title: 'Worktypes',
        href: '/worktypes',
        icon: Hammer,
        permission: 'worktypes.view',
    },
    {
        title: 'Users',
        href: '/users',
        icon: UsersRound,
        permission: 'users.view',
    },
    {
        title: 'Requisitions',
        href: '/requisition/all',
        icon: Folder,
        permission: 'requisitions.view',
    },
    {
        title: 'Variations',
        href: '/variations',
        icon: File,
        permission: 'variations.view',
    },
];

const timesheets = [
    {
        name: 'Timesheets',
        icon: Clock,
        permission: 'timesheets.view',
        subItems: [
            {
                name: 'Manage',
                url: '/timesheets',
                icon: Hourglass,
                permission: 'timesheets.view',
            },
            {
                name: 'Review',
                url: '/timesheets/review',
                icon: Hourglass,
                permission: 'timesheets.review',
            },
        ],
    },
];

const documents = [
    {
        name: 'Data',
        icon: Database,
        permission: 'materials.view',
        subItems: [
            {
                name: 'Material',
                url: '/material-items/all',
                icon: Pickaxe,
                permission: 'materials.view',
            },
            {
                name: 'Update Pricing',
                url: '/update-pricing',
                icon: RefreshCw,
                permission: 'materials.view',
            },
            {
                name: 'Suppliers',
                url: '/suppliers',
                icon: Box,
                permission: 'suppliers.view',
            },
            {
                name: 'Supplier Categories',
                url: '/supplier-categories',
                icon: FolderTree,
                permission: 'suppliers.view',
            },
            {
                name: 'Cost Codes',
                url: '/cost-codes',
                icon: Binary,
                permission: 'costcodes.view',
            },
            {
                name: 'Cost Types',
                url: '/cost-types',
                icon: Binary,
                permission: 'costtypes.view',
            },
            {
                name: 'Pay Rate Templates',
                url: '/pay-rate-templates',
                icon: DollarSign,
                permission: 'materials.view',
            },
            {
                name: 'Allowance Types',
                url: '/allowance-types',
                icon: DollarSign,
                permission: 'materials.view',
            },
        ],
    },
];

const reports = [
    {
        name: 'Reports',
        icon: FileSpreadsheet,
        permission: 'reports.view',
        subItems: [
            {
                name: 'Req Line Desc Report',
                url: '/reports/req-line-items-desc',
                icon: Pickaxe,
                permission: 'reports.requisition-lines',
            },
            {
                name: 'PO Comparison',
                url: '/reports/po-comparison',
                icon: GitCompare,
                permission: 'requisitions.view',
            },
            {
                name: 'Missing Sign-Out',
                url: '/reports/missing-sign-out',
                icon: UserX,
                permission: 'reports.missing-sign-out',
            },
        ],
    },
];

const admin = [
    {
        name: 'Administration',
        icon: Settings,
        permission: 'admin.roles',
        subItems: [
            {
                name: 'Roles & Permissions',
                url: '/admin/roles',
                icon: Shield,
                permission: 'admin.roles',
            },
            {
                name: 'All Permissions',
                url: '/admin/permissions',
                icon: Key,
                permission: 'admin.roles',
            },
        ],
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Queue Status',
        href: '/queue-status',
        icon: Activity,
        permission: 'queue-status.view',
    },
    {
        title: 'Calendar',
        href: '/calendar',
        icon: CalendarDays,
        permission: 'calendar.view',
    },
];

type AuthUser = {
    permissions: string[];
};

type PageProps = {
    auth: {
        user: AuthUser;
        permissions: string[];
        isAdmin: boolean;
    };
};

export function AppSidebar() {
    const { props } = usePage<PageProps>();
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
    const filteredAdmin = admin.filter((item) => !item.permission || permissions.includes(item.permission));

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
                <NavDocuments items={filteredAdmin} />
            </SidebarContent>

            <SidebarFooter>
                <TokenUsageWidget className="mb-2" />
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

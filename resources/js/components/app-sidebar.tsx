import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    BadgeDollarSign,
    Building,
    CalendarDays,
    ChartArea,
    ChartLine,
    ClipboardCheck,
    Clock,
    Database,
    DollarSign,
    FileDiff,
    FileBarChart,
    FileSpreadsheet,
    FileText,
    FolderTree,
    GitCompare,
    Hammer,
    HardHat,
    Hash,
    House,
    Hourglass,
    LayoutDashboard,
    LayoutGrid,
    Layers,
    ListChecks,
    Monitor,
    Pickaxe,
    PiggyBank,
    RefreshCcw,
    ShieldAlert,
    ShoppingCart,
    SlidersHorizontal,
    Store,
    TableProperties,
    Tags,
    UserX,
    UsersRound,
} from 'lucide-react';
import AppLogo from './app-logo';
import { NavDocuments } from './nav-documents';

const mainNavItems: NavItem[] = [
    {
        title: 'Home',
        href: '/dashboard',
        icon: House,
        permission: 'dashboard.view',
    },
    {
        title: 'Locations',
        href: '/locations',
        icon: Building,
        permission: 'locations.view',
    },
    {
        title: 'Project Dashboard',
        href: '/project-dashboard',
        icon: LayoutDashboard,
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
        icon: HardHat,
        permission: 'turnover-forecast.view',
    },
    {
        title: 'Cashflow Forecast',
        href: '/cash-forecast',
        icon: ChartArea,
        permission: 'cash-forecast.view',
    },
    {
        title: 'Employment Applications',
        href: '/employment-applications',
        icon: FileText,
        permission: 'employment-applications.view',
    },
    {
        title: 'Kiosks',
        href: '/kiosks',
        icon: Monitor,
        permission: 'kiosks.view',
    },
    {
        title: 'Requisitions',
        href: '/requisition/all',
        icon: ShoppingCart,
        permission: 'requisitions.view',
    },
    {
        title: 'Variations',
        href: '/variations',
        icon: FileDiff,
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
                icon: ClipboardCheck,
                permission: 'timesheets.review',
            },
        ],
    },
];

const documents = [
    {
        name: 'Master Data',
        icon: Database,
        permission: 'materials.view',
        groupByAlpha: true,
        subItems: [
            {
                name: 'Allowance Types',
                url: '/allowance-types',
                icon: DollarSign,
                permission: 'employees.manage-worktypes',
            },
            {
                name: 'Budget Management',
                url: '/budget-management',
                icon: PiggyBank,
                permission: 'budget.view',
            },
            {
                name: 'Cost Codes',
                url: '/cost-codes',
                icon: Hash,
                permission: 'costcodes.view',
            },
            {
                name: 'Cost Types',
                url: '/cost-types',
                icon: Layers,
                permission: 'costtypes.view',
            },
            {
                name: 'Employees',
                url: '/employees',
                icon: UsersRound,
                permission: 'employees.view',
            },
            {
                name: 'Material',
                url: '/material-items/all',
                icon: Pickaxe,
                permission: 'materials.view',
            },
            {
                name: 'Pay Rate Templates',
                url: '/pay-rate-templates',
                icon: BadgeDollarSign,
                permission: 'employees.manage-worktypes',
            },
            {
                name: 'Premier Sync',
                url: '/data-sync',
                icon: RefreshCcw,
                permission: 'locations.load-job-data',
            },
            {
                name: 'Supplier Categories',
                url: '/supplier-categories',
                icon: FolderTree,
                permission: 'suppliers.view',
            },
            {
                name: 'Suppliers',
                url: '/suppliers',
                icon: Store,
                permission: 'suppliers.view',
            },
            {
                name: 'Update Pricing',
                url: '/update-pricing',
                icon: Tags,
                permission: 'materials.edit',
            },
            {
                name: 'Worktypes',
                url: '/worktypes',
                icon: Hammer,
                permission: 'worktypes.view',
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
                name: 'PO Missing Codes',
                url: '/reports/req-line-items-desc',
                icon: FileBarChart,
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
            {
                name: 'Safety Dashboard',
                url: '/reports/safety-dashboard',
                icon: ShieldAlert,
                permission: 'reports.safety-dashboard',
            },
            {
                name: 'WIP Report',
                url: '/reports/wip',
                icon: TableProperties,
                permission: 'reports.wip',
            },
        ],
    },
];

const configuration = [
    {
        name: 'Configuration',
        icon: SlidersHorizontal,
        permission: 'checklists.manage-templates',
        subItems: [
            {
                name: 'Checklist Templates',
                url: '/checklist-templates',
                icon: ListChecks,
                permission: 'checklists.manage-templates',
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
    const filteredConfiguration = configuration.filter((item) => !item.permission || permissions.includes(item.permission));

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
                <NavDocuments items={filteredTimesheets} permissions={permissions} />
                <NavDocuments items={filteredDocuments} permissions={permissions} />
                <NavDocuments items={filteredReports} permissions={permissions} />
                <NavDocuments items={filteredConfiguration} permissions={permissions} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems.filter((item) => !item.permission || permissions.includes(item.permission))} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

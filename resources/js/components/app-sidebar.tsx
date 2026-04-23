import { NavFavorites, type FavoriteEntry } from '@/components/nav-favorites';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    BadgeDollarSign,
    Briefcase,
    Building,
    Building2,
    CalendarDays,
    ChartArea,
    ChartLine,
    ClipboardCheck,
    Clock,
    Database,
    DollarSign,
    FileBarChart,
    FileDiff,
    FileSpreadsheet,
    FileText,
    FlaskConical,
    FolderOpen,
    FolderTree,
    GitCompare,
    Hammer,
    HardHat,
    Hash,
    HeartPulse,
    House,
    Layers,
    LayoutDashboard,
    ListChecks,
    Monitor,
    NotepadText,
    Pickaxe,
    PiggyBank,
    Receipt,
    ReceiptText,
    RefreshCcw,
    Scale,
    ShieldAlert,
    ShieldCheck,
    ShoppingCart,
    SlidersHorizontal,
    Store,
    TableProperties,
    Tags,
    ArrowRightLeft,
    ToggleLeft,
    UserX,
    UsersRound,
    Wind,
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
        title: 'Requisitions',
        href: '/requisition/all',
        icon: ShoppingCart,
        permission: 'requisitions.view',
    },
];

const projects = [
    {
        name: 'Projects',
        icon: Briefcase,
        permission: 'locations.view',
        subItems: [
            {
                name: 'Locations',
                url: '/locations',
                icon: Building,
                permission: 'locations.view',
            },
            {
                name: 'Project Dashboard',
                url: '/project-dashboard',
                icon: LayoutDashboard,
                permission: 'project-dashboard.view',
            },
            {
                name: 'Variations',
                url: '/variations',
                icon: FileDiff,
                permission: 'variations.view',
            },
            {
                name: 'Labour Forecast',
                url: '/labour-forecast',
                icon: HardHat,
                permission: 'turnover-forecast.view',
            },
            {
                name: 'Labour Dashboard',
                url: '/labour-dashboard',
                icon: TableProperties,
                permission: 'turnover-forecast.view',
            },
        ],
    },
];

const finance = [
    {
        name: 'Finance',
        icon: DollarSign,
        permission: 'cash-forecast.view',
        subItems: [
            {
                name: 'Turnover Forecast',
                url: '/turnover-forecast',
                icon: ChartLine,
                permission: 'turnover-forecast.view',
            },
            {
                name: 'Cashflow Forecast',
                url: '/cash-forecast',
                icon: ChartArea,
                permission: 'cash-forecast.view',
            },
            {
                name: 'WIP',
                url: '/reports/wip',
                icon: TableProperties,
                permission: 'reports.wip',
            },
            {
                name: 'Retention Report',
                url: '/retention-report',
                icon: Scale,
                permission: 'reports.retention',
            },
            {
                name: 'Manage Receipts',
                url: '/manage-receipts',
                icon: ReceiptText,
                permission: 'receipts.manage',
            },
            {
                name: 'Budget Management',
                url: '/budget-management',
                icon: PiggyBank,
                permission: 'budget.view',
            },
        ],
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
                icon: Clock,
                permission: 'timesheets.view',
            },
            {
                name: 'Review',
                url: '/timesheet-review',
                icon: ClipboardCheck,
                permission: 'timesheets.review',
            },
            {
                name: 'EH Reconciliation',
                url: '/timesheets-reconcile',
                icon: Scale,
                permission: 'timesheets.sync',
            },
            {
                name: 'Kiosks',
                url: '/kiosks',
                icon: Monitor,
                permission: 'kiosks.view',
            },
            {
                name: 'Calendar',
                url: '/calendar',
                icon: CalendarDays,
                permission: 'calendar.view',
            },
        ],
    },
];

const workforce = [
    {
        name: 'Workforce',
        icon: UsersRound,
        permission: 'employment-applications.view',
        subItems: [
            {
                name: 'Enquiries',
                url: '/employment-applications',
                icon: FileText,
                permission: 'employment-applications.view',
            },
            {
                name: 'Worker Check',
                url: '/worker-check',
                icon: ShieldCheck,
                permission: 'worker-screening.search',
            },
            {
                name: 'Worker Screening',
                url: '/worker-screening',
                icon: ShieldAlert,
                permission: 'worker-screening.manage',
            },
            {
                name: 'Site Employees',
                url: '/employees',
                icon: UsersRound,
                permission: 'employees.view',
            },
            {
                name: 'Compliance',
                url: '/compliance-dashboard',
                icon: ClipboardCheck,
                permission: 'employees.view',
            },
            {
                name: 'Transfers',
                url: '/employee-transfers',
                icon: ArrowRightLeft,
                permission: 'employee-transfers.view',
            },
        ],
    },
];

const office = [
    {
        name: 'Office',
        icon: Building2,
        permission: 'employees.office.view',
        subItems: [
            {
                name: 'Office Employees',
                url: '/office-employees',
                icon: UsersRound,
                permission: 'employees.office.view',
            },
            {
                name: 'Signing Requests',
                url: '/signing-requests',
                icon: FileText,
                permission: 'signing-requests.view',
            },
        ],
    },
];

const safety = [
    {
        name: 'Safety',
        icon: ShieldAlert,
        permission: 'sds.view',
        subItems: [
            {
                name: 'Injury Register',
                url: '/injury-register',
                icon: HeartPulse,
                permission: 'injury-register.view',
            },
            {
                name: 'Daily Prestarts',
                url: '/daily-prestarts',
                icon: ClipboardCheck,
                permission: 'prestarts.view',
            },
            {
                name: 'Toolbox Talks',
                url: '/toolbox-talks',
                icon: HardHat,
                permission: 'prestarts.view',
            },
            {
                name: 'Absentees',
                url: '/absent',
                icon: UserX,
                permission: 'prestarts.view',
            },
            {
                name: 'SDS Register',
                url: '/sds',
                icon: FlaskConical,
                permission: 'sds.view',
            },
            {
                name: 'Silica Register',
                url: '/silica-register',
                icon: Wind,
                permission: 'silica-register.view',
            },
            {
                name: 'Safety Dashboard',
                url: '/safety-dashboard',
                icon: ShieldAlert,
                permission: 'reports.safety-dashboard',
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
                name: 'Timesheet vs DPC',
                url: '/reports/timesheet-vs-dpc',
                icon: Scale,
                permission: 'reports.timesheet-vs-dpc',
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
            {
                name: 'Document Templates',
                url: '/document-templates',
                icon: NotepadText,
                permission: 'document-templates.manage',
            },
            {
                name: 'Feature Flags',
                url: '/admin/feature-flags',
                icon: ToggleLeft,
                permission: 'feature-flags.manage',
            },
            {
                name: 'Employee File Types',
                url: '/employee-file-types',
                icon: FolderOpen,
                permission: 'checklists.manage-templates',
            },
        ],
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'My Receipts',
        href: '/my-receipts',
        icon: Receipt,
        permission: 'receipts.view',
    },
    {
        title: 'Queue Status',
        href: '/queue-status',
        icon: Activity,
        permission: 'queue-status.view',
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
    const filterGroup = (group: typeof projects) =>
        group.filter((item) => {
            // Show group if user has permission for any sub-item
            if (item.subItems?.length) {
                return item.subItems.some((sub) => !sub.permission || permissions.includes(sub.permission));
            }
            return !item.permission || permissions.includes(item.permission);
        });

    const filteredProjects = filterGroup(projects);
    const filteredFinance = filterGroup(finance);
    const filteredTimesheets = filterGroup(timesheets);
    const filteredWorkforce = filterGroup(workforce);
    const filteredOffice = filterGroup(office);
    const filteredSafety = filterGroup(safety);
    const filteredDocuments = filterGroup(documents);
    const filteredReports = filterGroup(reports);
    const filteredConfiguration = filterGroup(configuration);
    const filteredFooterNavItems = footerNavItems.filter((item) => !item.permission || permissions.includes(item.permission));

    const allNavGroups = [
        filteredProjects,
        filteredFinance,
        filteredTimesheets,
        filteredWorkforce,
        filteredOffice,
        filteredSafety,
        filteredDocuments,
        filteredReports,
        filteredConfiguration,
    ];
    const allItems: FavoriteEntry[] = [
        ...filteredMainNavItems.map((item) => ({ title: item.title, url: item.href, icon: item.icon! })),
        ...filteredFooterNavItems.map((item) => ({ title: item.title, url: item.href, icon: item.icon! })),
        ...allNavGroups.flatMap((group) =>
            group.flatMap((g) =>
                (g.subItems ?? [])
                    .filter((sub) => !sub.permission || permissions.includes(sub.permission))
                    .map((sub) => ({ title: sub.name, url: sub.url, icon: sub.icon })),
            ),
        ),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" render={<Link href="/dashboard" prefetch />}>
                            <AppLogo />
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavFavorites allItems={allItems} />
                <NavMain items={filteredMainNavItems} />
                <NavDocuments items={filteredProjects} permissions={permissions} />
                <NavDocuments items={filteredFinance} permissions={permissions} />
                <NavDocuments items={filteredTimesheets} permissions={permissions} />
                <NavDocuments items={filteredWorkforce} permissions={permissions} />
                <NavDocuments items={filteredOffice} permissions={permissions} />
                <NavDocuments items={filteredSafety} permissions={permissions} />
                <NavDocuments items={filteredDocuments} permissions={permissions} />
                <NavDocuments items={filteredReports} permissions={permissions} />
                <NavDocuments items={filteredConfiguration} permissions={permissions} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={filteredFooterNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

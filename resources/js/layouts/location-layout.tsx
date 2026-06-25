import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';



export type LocationTab = 'details' | 'sublocations' | 'cost-codes' | 'price-list' | 'favourites' | 'production-data' | 'schedule';

type RailItem = {
    key: LocationTab;
    label: string;
    countKey?: string;
    permissionKey?: string;
};

type RailGroup = {
    label?: string;
    items: RailItem[];
};

const RAIL: RailGroup[] = [
    {
        items: [
            { key: 'details', label: 'Details' },
            { key: 'sublocations', label: 'Sub-locations', countKey: 'sublocations' },
            { key: 'cost-codes', label: 'Cost Codes', countKey: 'cost_codes', permissionKey: 'cost_codes' },
        ],
    },
    {
        label: 'Purchasing',
        items: [
            { key: 'price-list', label: 'Price List', countKey: 'price_list', permissionKey: 'price_list' },
            { key: 'favourites', label: 'Favourites', countKey: 'favourites', permissionKey: 'favourites' },
        ],
    },
    {
        label: 'Project',
        items: [
            { key: 'production-data', label: 'DPC Data', countKey: 'production_data', permissionKey: 'production_data' },
            { key: 'schedule', label: 'Schedule', countKey: 'tasks', permissionKey: 'schedule' },
        ],
    },
];

export type LocationBase = {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
    external_id: string;
    closed_at?: string | null;
    variation_number_start: number | null;
    variation_next_number: number | null;
    sell_multiplier_percentage: number | string | null;
    worktypes: Array<{
        id: number;
        name: string;
        eh_worktype_id: string;
    }>;
    tab_counts: {
        sublocations: number;
        cost_codes: number;
        price_list: number;
        favourites: number;
        production_data: number;
        tasks: number;
    };
    tab_permissions: {
        cost_codes: boolean;
        price_list: boolean;
        favourites: boolean;
        production_data: boolean;
        schedule: boolean;
    };
};

interface LocationLayoutProps {
    location: LocationBase;
    activeTab: LocationTab;
    children: ReactNode;
}

export default function LocationLayout({ location, activeTab, children }: LocationLayoutProps) {
    const { flash } = usePage<{ flash: { success?: string } }>().props;

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
    ];

    const getTabHref = (tab: LocationTab) => {
        if (tab === 'sublocations') return `/locations/${location.id}`;
        return `/locations/${location.id}/${tab}`;
    };

    const visibleGroups = RAIL.map((group) => ({
        ...group,
        items: group.items.filter(
            (item) => !item.permissionKey || location.tab_permissions?.[item.permissionKey as keyof typeof location.tab_permissions],
        ),
    })).filter((group) => group.items.length > 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Location`} />

            <div className="mx-auto w-full max-w-6xl p-2 sm:p-4 md:p-6">
                {location.closed_at && (
                    <div className="border-muted-foreground/20 bg-muted/40 text-muted-foreground mb-3 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                        <Lock className="h-3.5 w-3.5" />
                        <span>This project is closed — it's hidden from listing views.</span>
                    </div>
                )}
                <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
                    <nav
                        aria-label="Sections"
                        className="flex flex-col gap-0.5 lg:sticky lg:top-4 lg:self-start"
                    >
                        {visibleGroups.map((group, groupIdx) => (
                            <div key={group.label ?? `group-${groupIdx}`} className="space-y-0.5">
                                {group.label && (
                                    <div className="text-muted-foreground px-2.5 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase first:pt-0">
                                        {group.label}
                                    </div>
                                )}
                                {group.items.map((item) => {
                                    const active = activeTab === item.key;
                                    const count =
                                        item.countKey != null
                                            ? (location.tab_counts?.[item.countKey as keyof typeof location.tab_counts] ?? 0)
                                            : undefined;
                                    return (
                                        <Link
                                            key={item.key}
                                            href={getTabHref(item.key)}
                                            className={cn(
                                                'flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                                                active
                                                    ? 'bg-muted text-foreground font-medium'
                                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                            )}
                                        >
                                            <span>{item.label}</span>
                                            {typeof count === 'number' && (
                                                <span
                                                    className={cn(
                                                        'text-xs tabular-nums',
                                                        active ? 'text-muted-foreground' : 'text-muted-foreground/70',
                                                    )}
                                                >
                                                    {count}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>

                    <div className="min-w-0 space-y-3">{children}</div>
                </div>
            </div>
        </AppLayout>
    );
}

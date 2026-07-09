import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

export type KioskTab = 'employees' | 'events' | 'managers' | 'devices' | 'settings';

type RailItem = {
    key: KioskTab;
    label: string;
    countKey?: keyof KioskBase['tab_counts'];
};

const RAIL: RailItem[] = [
    { key: 'employees', label: 'Employees', countKey: 'employees' },
    { key: 'events', label: 'Timesheet Events', countKey: 'events' },
    { key: 'managers', label: 'Managers', countKey: 'managers' },
    { key: 'devices', label: 'Devices', countKey: 'devices' },
    { key: 'settings', label: 'Settings' },
];

export type KioskBase = {
    id: number;
    name?: string;
    eh_kiosk_id?: number | string;
    is_active: boolean;
    tab_counts: {
        employees: number;
        events: number;
        managers: number;
        devices: number;
    };
};

interface KioskLayoutProps {
    kiosk: KioskBase;
    activeTab: KioskTab;
    children: ReactNode;
}

export default function KioskLayout({ kiosk, activeTab, children }: KioskLayoutProps) {
    const { flash, errors } = usePage<{ flash: { success?: string; error?: string }; errors: Record<string, string> }>().props;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Kiosks', href: '/kiosks' },
        { title: kiosk.name ?? 'Edit Kiosk', href: `/kiosks/${kiosk.id}/edit` },
    ];

    const getTabHref = (tab: KioskTab) => {
        if (tab === 'employees') return `/kiosks/${kiosk.id}/edit`;
        return `/kiosks/${kiosk.id}/edit/${tab}`;
    };

    const toggleActive = () => {
        router.post(route('kiosk.toggleActive', kiosk.id), {}, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit · ${kiosk.name ?? 'Kiosk'}`} />

            <div className="mx-auto w-full max-w-6xl p-2 sm:p-4 md:p-6">
                {errors && Object.keys(errors).length > 0 && (
                    <div className="mb-3">
                        {Object.values(errors).map((msg, i) => (
                            <div key={i} className="text-sm text-red-500">
                                {msg}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mb-4 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-semibold">{kiosk.name ?? 'Kiosk'}</h1>
                        <p className="text-muted-foreground text-xs">Configure employees, timesheet events, managers, devices and settings.</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                        <div className={`h-2 w-2 rounded-full ${kiosk.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <Label htmlFor="kiosk-active" className="text-sm">
                            {kiosk.is_active ? 'Active for timesheets' : 'Inactive'}
                        </Label>
                        <Switch id="kiosk-active" checked={kiosk.is_active} onCheckedChange={toggleActive} />
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
                    <nav aria-label="Sections" className="flex flex-col gap-0.5 lg:sticky lg:top-4 lg:self-start">
                        {RAIL.map((item) => {
                            const active = activeTab === item.key;
                            const count = item.countKey != null ? (kiosk.tab_counts?.[item.countKey] ?? 0) : undefined;
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
                    </nav>

                    <div className="min-w-0 space-y-3">{children}</div>
                </div>
            </div>
        </AppLayout>
    );
}

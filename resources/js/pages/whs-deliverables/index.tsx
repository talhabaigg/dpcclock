import { SuccessAlertFlash } from '@/components/alert-flash';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Bell, ImageIcon, Plus, Search, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import WhsDeliverableFiltersSheet from './filters-sheet';
import {
    cardSubline,
    formatDate,
    statusBadgeClass,
    statusDotClass,
    statusLabel,
    TYPE_ORDER,
    type DeliverableCard,
    type DeliverableLocation,
    type DeliverableType,
    type TypesConfig,
} from './shared';

const LAST_LOCATION_KEY = 'whs-deliverables.lastLocationId';

interface Props {
    location: DeliverableLocation;
    entries: DeliverableCard[];
    filters: { type: DeliverableType | null; expiry: string | null; notify: 'yes' | 'no' | null; q: string | null };
    expiryOptions: Record<string, string>;
    types: TypesConfig;
    siblings: DeliverableLocation[];
}

export default function WhsDeliverablesIndex({ location, entries, filters, expiryOptions, types, siblings }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props;
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const baseUrl = `/locations/${location.id}/whs-deliverables`;

    const [query, setQuery] = useState(filters.q ?? '');
    const activeFilterCount = (filters.expiry ? 1 : 0) + (filters.notify ? 1 : 0);

    useEffect(() => {
        localStorage.setItem(LAST_LOCATION_KEY, String(location.id));
    }, [location.id]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'WHS Deliverables', href: '/whs-deliverables' },
        { title: location.name, href: baseUrl },
    ];

    const applyFilters = (next: Partial<{ type: string | null; expiry: string | null; notify: string | null; q: string | null }>) => {
        const merged = {
            type: filters.type ?? undefined,
            expiry: filters.expiry ?? undefined,
            notify: filters.notify ?? undefined,
            q: filters.q ?? undefined,
            ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v || undefined])),
        };
        router.get(baseUrl, merged, { preserveState: true, preserveScroll: true, replace: true });
    };

    // Debounce the search box.
    useEffect(() => {
        const current = filters.q ?? '';
        if (query === current) return;
        const t = setTimeout(() => applyFilters({ q: query || null }), 350);
        return () => clearTimeout(t);
    }, [query]);

    const switchLocation = (id: number) => {
        localStorage.setItem(LAST_LOCATION_KEY, String(id));
        router.visit(`/locations/${id}/whs-deliverables`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`WHS Deliverables — ${location.name}`} />
            <SuccessAlertFlash message={flash?.success} />

            <div className="mx-auto w-full max-w-5xl space-y-5 p-4">
                {/* controls */}
                <div className="space-y-3">
                    {/* search + actions */}
                    <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1 sm:max-w-xs">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name…"
                                className="h-9 pl-9 text-sm"
                            />
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            <WhsDeliverableFiltersSheet
                                location={location}
                                siblings={siblings}
                                filters={{ expiry: filters.expiry, notify: filters.notify }}
                                expiryOptions={expiryOptions}
                                activeCount={activeFilterCount}
                                onChange={(key, value) => applyFilters({ [key]: value })}
                                onReset={() => applyFilters({ expiry: null, notify: null })}
                                onSwitchLocation={switchLocation}
                            />
                            {can('whs-deliverables.create') && (
                                <Button size="sm" asChild className="h-9 gap-1.5 text-xs">
                                    <Link href={`${baseUrl}/create`}>
                                        <Plus className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">New deliverable</span>
                                        <span className="sm:hidden">New</span>
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* type chips — horizontal scroll on phone instead of wrapping */}
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                        <button
                            type="button"
                            onClick={() => applyFilters({ type: null })}
                            className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                !filters.type ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'
                            }`}
                        >
                            All
                        </button>
                        {TYPE_ORDER.filter((t) => types[t]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => applyFilters({ type: filters.type === t ? null : t })}
                                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                    filters.type === t
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-background hover:bg-muted'
                                }`}
                            >
                                {types[t].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* cards */}
                {entries.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-16 text-center">
                        <div className="text-muted-foreground text-sm">No deliverables found</div>
                        <div className="text-muted-foreground/70 mt-1 text-xs">Try a different filter or add a new deliverable.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                        {entries.map((entry) => (
                            <DeliverableGridCard key={entry.id} entry={entry} baseUrl={baseUrl} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function DeliverableGridCard({ entry, baseUrl }: { entry: DeliverableCard; baseUrl: string }) {
    const subline = cardSubline(entry);

    return (
        <Link
            href={`${baseUrl}/${entry.id}`}
            className="group bg-card hover:border-foreground/20 hover:bg-muted/30 flex flex-col rounded-xl border p-4 transition-colors"
        >
            <div className="flex items-start gap-3">
                <div className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    {entry.photo_url ? (
                        <img src={entry.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : entry.type === 'electrical' ? (
                        <Zap className="h-5 w-5" />
                    ) : (
                        <ImageIcon className="h-5 w-5" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-sm leading-tight font-semibold">{entry.name}</div>
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDotClass(entry.status_key)}`} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                        <span className="bg-muted text-foreground/80 rounded px-1.5 py-0.5 text-[11px] font-medium">{entry.type_label}</span>
                        {entry.notify && <Bell className="text-muted-foreground h-3 w-3" />}
                    </div>
                </div>
            </div>
            {subline && <div className="text-muted-foreground mt-2.5 truncate font-mono text-xs">{subline}</div>}
            <div className="mt-3.5 flex items-center justify-between border-t pt-3">
                <div>
                    <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{entry.next_label}</div>
                    <div className="mt-0.5 font-mono text-xs font-medium">{formatDate(entry.next_date)}</div>
                </div>
                <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${statusBadgeClass(entry.status_key)}`}>
                    {statusLabel(entry.status_key, entry.days_until)}
                </span>
            </div>
        </Link>
    );
}

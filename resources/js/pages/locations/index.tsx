import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowUpDown, CheckCircle2, EllipsisVertical, Loader2, MapPin, Menu, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Locations', href: '/locations' }];

type Location = {
    id: number;
    name: string;
    eh_location_id: string;
    external_id: string;
    eh_parent_id: string | null;
    state: string | null;
    closed_at: string | null;
    subLocations: Array<{ id: number; name: string; eh_location_id: string; external_id: string }>;
};

const companyTabs = [
    { value: 'all', label: 'All' },
    { value: '1149031', label: 'SWC' },
    { value: '1249093', label: 'SWCP' },
    { value: '1198645', label: 'Greenline' },
];

type LocationAction = 'close' | 'reopen' | 'resync';
type ActionItem =
    | { kind: 'separator' }
    | { kind: 'label'; text: string }
    | { kind: 'link'; href: string; label: string; isExternal?: boolean }
    | { kind: 'action'; label: string; action: LocationAction; destructive?: boolean };

function getActions(location: Location, canClose: boolean): ActionItem[] {
    const items: ActionItem[] = [
        { kind: 'link', href: `/locations/${location.id}/dashboard`, label: 'Project Dashboard' },
        { kind: 'separator' },
        { kind: 'link', href: `/location/${location.id}/job-forecast`, label: 'Job Forecast' },
        { kind: 'link', href: `/projects/${location.id}/drawings`, label: 'Drawings' },
        { kind: 'link', href: `/projects/${location.id}/tasks`, label: 'Tasks' },
        { kind: 'link', href: `/locations/${location.id}/variations`, label: 'Variations' },
        { kind: 'link', href: `/locations/${location.id}/schedule`, label: 'Schedule' },
        { kind: 'separator' },
        { kind: 'link', href: `/locations/${location.id}/sds`, label: 'SDS Register' },
        { kind: 'link', href: `/locations/${location.id}/sds/download`, label: 'Download SDS PDF', isExternal: true },
        { kind: 'separator' },
        { kind: 'label', text: 'Admin' },
        { kind: 'link', href: `/location/${location.id}/material-item-price-list-uploads`, label: 'Audit Uploads' },
        { kind: 'link', href: route('location.req-header.edit', { locationId: location.id }), label: 'Requisition Header' },
        { kind: 'action', label: 'Resync Timesheets', action: 'resync' },
    ];
    if (canClose) {
        items.push(
            { kind: 'separator' },
            location.closed_at
                ? { kind: 'action', label: 'Reopen Project', action: 'reopen' }
                : { kind: 'action', label: 'Close Project', action: 'close', destructive: true },
        );
    }
    return items;
}

function LocationActions({
    location,
    canClose,
    onAction,
}: {
    location: Location;
    canClose: boolean;
    onAction: (location: Location, action: LocationAction) => void;
}) {
    const items = getActions(location, canClose);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                {items.map((item, i) => {
                    if (item.kind === 'separator') return <DropdownMenuSeparator key={`sep-${i}`} />;
                    if (item.kind === 'label')
                        return (
                            <DropdownMenuLabel key={`label-${i}`} className="text-muted-foreground text-xs">
                                {item.text}
                            </DropdownMenuLabel>
                        );
                    if (item.kind === 'action')
                        return (
                            <DropdownMenuItem
                                key={item.label}
                                className={item.destructive ? 'text-destructive focus:text-destructive' : ''}
                                onClick={() => onAction(location, item.action)}
                            >
                                {item.label}
                            </DropdownMenuItem>
                        );
                    return (
                        <DropdownMenuItem key={item.label} asChild>
                            {item.isExternal ? <a href={item.href}>{item.label}</a> : <Link href={item.href}>{item.label}</Link>}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function LocationCard({
    location,
    canClose,
    onAction,
}: {
    location: Location;
    canClose: boolean;
    onAction: (location: Location, action: LocationAction) => void;
}) {
    return (
        <div className={`bg-background rounded-md border p-3 ${location.closed_at ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Link href={`locations/${location.id}`} className="font-medium hover:underline">
                            {location.name}
                        </Link>
                        {location.closed_at && (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                                Closed
                            </Badge>
                        )}
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-mono">{location.eh_location_id}</span>
                        {location.external_id && <span className="font-mono">{location.external_id}</span>}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {location.state && <Badge variant="secondary">{location.state}</Badge>}
                    <LocationActions location={location} canClose={canClose} onAction={onAction} />
                </div>
            </div>
        </div>
    );
}

type ConfirmState = {
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
};

function ConfirmDialog({ state, onCancel }: { state: ConfirmState | null; onCancel: () => void }) {
    if (!state) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background w-full max-w-md rounded-lg border p-6 shadow-lg">
                <h2 className="text-lg font-semibold">{state.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm">{state.description}</p>
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button variant={state.destructive ? 'destructive' : 'default'} onClick={state.onConfirm}>
                        {state.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function LocationsList() {
    const {
        locations,
        flash,
        showClosed: initialShowClosed,
        can,
    } = usePage<{
        locations: Location[];
        flash: { success?: string; error?: string };
        showClosed?: boolean;
        can?: { closeProjects?: boolean };
    }>().props;

    const canClose = can?.closeProjects ?? false;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('companySelected') ?? 'all');
    const [showClosed, setShowClosed] = useState(initialShowClosed ?? false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [busyMessage, setBusyMessage] = useState<string | null>(null);

    const { sortedItems: sortedLocations, handleSort } = useSortableData<Location>(locations, { field: 'name', order: 'asc' });

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        localStorage.setItem('companySelected', value);
    };

    const handleToggleClosed = (checked: boolean) => {
        setShowClosed(checked);
        router.get('/locations', checked ? { show_closed: '1' } : {}, { preserveState: true, replace: true });
    };

    const handleAction = (location: Location, action: LocationAction) => {
        if (action === 'close') {
            setConfirm({
                title: 'Close Project',
                description: (
                    <>
                        Close <strong>{location.name}</strong>? This hides the project and its data from listing views. You can reopen it later.
                    </>
                ),
                confirmLabel: 'Close Project',
                destructive: true,
                onConfirm: () => {
                    setConfirm(null);
                    setBusyMessage('Closing project...');
                    router.post(
                        `/locations/${location.id}/close`,
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setBusyMessage(null),
                        },
                    );
                },
            });
        } else if (action === 'reopen') {
            setBusyMessage('Reopening project...');
            router.post(
                `/locations/${location.id}/reopen`,
                {},
                {
                    preserveScroll: true,
                    onFinish: () => setBusyMessage(null),
                },
            );
        } else if (action === 'resync') {
            setConfirm({
                title: 'Resync Timesheets',
                description: (
                    <>
                        Queue a full backfill of timesheets from Employment Hero for <strong>{location.name}</strong>? This pulls the entire history
                        and may take a while.
                    </>
                ),
                confirmLabel: 'Queue Resync',
                onConfirm: () => {
                    setConfirm(null);
                    router.post(`/locations/${location.id}/load-timesheets`, {}, { preserveScroll: true });
                },
            });
        }
    };

    const filteredLocations = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return sortedLocations.filter((location) => {
            if (activeTab !== 'all' && location.eh_parent_id !== activeTab) return false;
            if (!query) return true;
            return (
                location.name.toLowerCase().includes(query) ||
                location.external_id?.toLowerCase().includes(query) ||
                location.eh_location_id?.toLowerCase().includes(query)
            );
        });
    }, [sortedLocations, activeTab, searchQuery]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />

            <div className="@container mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 p-4">
                {flash.success && (
                    <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}
                {flash.error && (
                    <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{flash.error}</AlertDescription>
                    </Alert>
                )}

                {/* Toolbar */}
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1 @md:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                    </div>

                    <Tabs value={activeTab} onValueChange={handleTabChange} className="min-w-0">
                        <TabsList>
                            {companyTabs.map((tab) => (
                                <TabsTrigger key={tab.value} value={tab.value}>
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="ml-auto" aria-label="More actions">
                                <Menu className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                            <DropdownMenuCheckboxItem checked={showClosed} onCheckedChange={handleToggleClosed}>
                                Show closed projects
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    setOpen(true);
                                    router.get('/locations/sync');
                                }}
                            >
                                Sync locations
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Content */}
                {filteredLocations.length === 0 ? (
                    <Empty className="border">
                        <EmptyMedia variant="icon">
                            <MapPin />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle>No locations found</EmptyTitle>
                            <EmptyDescription>
                                {searchQuery
                                    ? 'Try adjusting your search criteria.'
                                    : activeTab !== 'all'
                                      ? 'No locations for this company.'
                                      : 'Sync locations to get started.'}
                            </EmptyDescription>
                        </EmptyHeader>
                        {(searchQuery || activeTab !== 'all') && (
                            <EmptyContent>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setActiveTab('all');
                                    }}
                                >
                                    Clear filters
                                </Button>
                            </EmptyContent>
                        )}
                    </Empty>
                ) : (
                    <>
                        {/* Narrow: card stack */}
                        <div className="flex flex-col gap-2 @3xl:hidden">
                            {filteredLocations.map((location) => (
                                <LocationCard key={location.id} location={location} canClose={canClose} onAction={handleAction} />
                            ))}
                        </div>

                        {/* Wide: table */}
                        <div className="hidden rounded-lg border @3xl:block">
                            <Table className="table-fixed">
                                <colgroup>
                                    <col className="w-[14%]" />
                                    <col className="w-[50%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[6%]" />
                                </colgroup>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-4">ID</TableHead>
                                        <TableHead>
                                            <button
                                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
                                                onClick={() => handleSort('name')}
                                            >
                                                Name
                                                <ArrowUpDown className="h-3.5 w-3.5" />
                                            </button>
                                        </TableHead>
                                        <TableHead>State</TableHead>
                                        <TableHead>
                                            <button
                                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
                                                onClick={() => handleSort('external_id')}
                                            >
                                                External ID
                                                <ArrowUpDown className="h-3.5 w-3.5" />
                                            </button>
                                        </TableHead>
                                        <TableHead className="pr-4"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLocations.map((location) => (
                                        <TableRow key={location.id} className={location.closed_at ? 'opacity-60' : ''}>
                                            <TableCell className="text-muted-foreground truncate overflow-hidden pl-4 font-mono text-xs">
                                                {location.eh_location_id}
                                            </TableCell>
                                            <TableCell className="overflow-hidden font-medium whitespace-normal">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`locations/${location.id}`} className="hover:underline">
                                                        {location.name}
                                                    </Link>
                                                    {location.closed_at && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                                        >
                                                            Closed
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="truncate overflow-hidden">
                                                {location.state && <Badge variant="secondary">{location.state}</Badge>}
                                            </TableCell>
                                            <TableCell className="truncate overflow-hidden">
                                                {location.external_id ? (
                                                    <span className="text-muted-foreground font-mono text-xs">{location.external_id}</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="pr-4">
                                                <LocationActions location={location} canClose={canClose} onAction={handleAction} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>

            <LoadingDialog open={open} setOpen={setOpen} />

            {busyMessage && (
                <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center">
                    <div className="bg-background flex flex-col items-center gap-2 rounded-lg border p-6 shadow-lg">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-sm font-medium">{busyMessage}</p>
                    </div>
                </div>
            )}

            <ConfirmDialog state={confirm} onCancel={() => setConfirm(null)} />
        </AppLayout>
    );
}

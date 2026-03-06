import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowUpDown,
    ChartColumnIncreasing,
    CheckCircle2,
    ClockAlert,
    Code2,
    DollarSign,
    EllipsisVertical,
    Eye,
    FileImage,
    Heart,
    Loader2,
    Lock,
    MapPin,
    Pencil,
    RefreshCcw,
    RotateCcw,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Locations',
        href: '/locations',
    },
];

type Location = {
    id: number;
    name: string;
    eh_location_id: string;
    external_id: string;
    eh_parent_id: string | null;
    state: string | null;
    closed_at: string | null;
    subLocations: Array<{
        id: number;
        name: string;
        eh_location_id: string;
        external_id: string;
    }>;
    worktypes: Array<{
        id: number;
        name: string;
        eh_worktype_id: string;
    }>;
};

const companyTabs = [
    { value: 'all', label: 'All' },
    { value: '1149031', label: 'SWC' },
    { value: '1249093', label: 'SWCP' },
    { value: '1198645', label: 'Greenline' },
];

function getLocationActions(location: Location, canClose: boolean) {
    const actions = [
        {
            group: 'View',
            items: [
                { href: `/locations/${location.id}`, icon: Eye, label: 'Overview' },
                { href: `/locations/${location.id}/cost-codes`, icon: Code2, label: 'Cost Codes' },
                { href: `/locations/${location.id}/price-list`, icon: DollarSign, label: 'Price List' },
                { href: `/locations/${location.id}/favourites`, icon: Heart, label: 'Favourites' },
            ],
        },
        {
            group: 'Tools',
            items: [
                { href: `/location/${location.id}/job-forecast`, icon: ChartColumnIncreasing, label: 'Job Forecast' },
                { href: `/projects/${location.id}/drawings`, icon: FileImage, label: 'Drawings' },
                { href: `/locations/${location.id}/variations`, icon: Eye, label: 'Variations' },
            ],
        },
        {
            group: 'Admin',
            items: [
                { href: `/location/${location.id}/material-item-price-list-uploads`, icon: ClockAlert, label: 'Audit Uploads' },
                { href: route('location.req-header.edit', { locationId: location.id }), icon: Pencil, label: 'Requisition Header' },
            ],
        },
    ];

    if (canClose) {
        const closeItem = location.closed_at
            ? { href: '#reopen', icon: RotateCcw, label: 'Reopen Project', action: 'reopen' as const }
            : { href: '#close', icon: Lock, label: 'Close Project', action: 'close' as const };
        actions[2].items.push(closeItem);
    }

    return actions;
}

type ActionItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; action?: 'close' | 'reopen' };

function LocationActions({
    location,
    canClose,
    onCloseReopen,
}: {
    location: Location;
    canClose: boolean;
    onCloseReopen: (location: Location, action: 'close' | 'reopen') => void;
}) {
    const actions = getLocationActions(location, canClose);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {actions.map((group, gi) => (
                    <div key={group.group}>
                        {gi > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className={gi === 0 ? '' : 'text-muted-foreground text-xs'}>{group.group}</DropdownMenuLabel>
                        {gi === 0 && <DropdownMenuSeparator />}
                        {group.items.map((item) => {
                            const typedItem = item as ActionItem;
                            if (typedItem.action) {
                                return (
                                    <DropdownMenuItem
                                        key={typedItem.label}
                                        className="gap-2"
                                        onClick={() => onCloseReopen(location, typedItem.action!)}
                                    >
                                        <typedItem.icon className="h-4 w-4" />
                                        {typedItem.label}
                                    </DropdownMenuItem>
                                );
                            }
                            return (
                                <Link key={typedItem.label} href={typedItem.href}>
                                    <DropdownMenuItem className="gap-2">
                                        <typedItem.icon className="h-4 w-4" />
                                        {typedItem.label}
                                    </DropdownMenuItem>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function LocationActionsMobile({
    location,
    canClose,
    onCloseReopen,
}: {
    location: Location;
    canClose: boolean;
    onCloseReopen: (location: Location, action: 'close' | 'reopen') => void;
}) {
    const actions = getLocationActions(location, canClose);
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                    <SheetTitle>{location.name}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4 pb-6">
                    {actions.map((group, gi) => (
                        <div key={group.group}>
                            {gi > 0 && <Separator className="my-2" />}
                            <p className="text-muted-foreground mb-1 px-3 text-xs font-medium">{group.group}</p>
                            {group.items.map((item) => {
                                const typedItem = item as ActionItem;
                                if (typedItem.action) {
                                    return (
                                        <button
                                            key={typedItem.label}
                                            onClick={() => onCloseReopen(location, typedItem.action!)}
                                            className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium"
                                        >
                                            <typedItem.icon className="text-muted-foreground h-4 w-4" />
                                            {typedItem.label}
                                        </button>
                                    );
                                }
                                return (
                                    <Link
                                        key={typedItem.label}
                                        href={typedItem.href}
                                        className="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium"
                                    >
                                        <typedItem.icon className="text-muted-foreground h-4 w-4" />
                                        {typedItem.label}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    );
}

export default function LocationsList() {
    const { locations, flash, showClosed: initialShowClosed, can } = usePage<{
        locations: Location[];
        flash: { success?: string; error?: string };
        showClosed?: boolean;
        can?: { closeProjects?: boolean };
    }>().props;

    const canClose = can?.closeProjects ?? false;
    const isLoading = false;
    const [open, setOpen] = useState(isLoading);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('companySelected') ?? 'all');
    const [showClosed, setShowClosed] = useState(initialShowClosed ?? false);
    const [closeDialog, setCloseDialog] = useState<{ location: Location; action: 'close' | 'reopen' } | null>(null);
    const [closingMessage, setClosingMessage] = useState<string | null>(null);

    const { sortedItems: sortedLocations, handleSort } = useSortableData<Location>(locations, { field: 'name', order: 'asc' });

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        localStorage.setItem('companySelected', value);
    };

    const handleToggleClosed = (checked: boolean) => {
        setShowClosed(checked);
        router.get('/locations', checked ? { show_closed: '1' } : {}, {
            preserveState: true,
            replace: true,
        });
    };

    const handleCloseReopen = (location: Location, action: 'close' | 'reopen') => {
        if (action === 'close') {
            setCloseDialog({ location, action });
        } else {
            setClosingMessage('Reopening project...');
            router.post(`/locations/${location.id}/reopen`, {}, {
                preserveScroll: true,
                onFinish: () => setClosingMessage(null),
            });
        }
    };

    const confirmClose = () => {
        if (!closeDialog) return;
        const locationId = closeDialog.location.id;
        setCloseDialog(null);
        setClosingMessage('Closing project...');
        router.post(`/locations/${locationId}/close`, {}, {
            preserveScroll: true,
            onFinish: () => setClosingMessage(null),
        });
    };

    const companyFilteredLocations = useMemo(() => {
        return activeTab === 'all' ? sortedLocations : sortedLocations.filter((location) => location.eh_parent_id === activeTab);
    }, [sortedLocations, activeTab]);

    const filteredLocations = useMemo(() => {
        if (!searchQuery) return companyFilteredLocations;

        const query = searchQuery.toLowerCase();
        return companyFilteredLocations.filter(
            (location) =>
                location.name.toLowerCase().includes(query) ||
                location.external_id?.toLowerCase().includes(query) ||
                location.eh_location_id?.toLowerCase().includes(query),
        );
    }, [companyFilteredLocations, searchQuery]);

    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = { all: sortedLocations.length };
        for (const tab of companyTabs) {
            if (tab.value !== 'all') {
                counts[tab.value] = sortedLocations.filter((l) => l.eh_parent_id === tab.value).length;
            }
        }
        return counts;
    }, [sortedLocations]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />

            <div className="@container flex min-w-0 flex-col gap-4 p-4">
                {/* Flash Messages */}
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
                <div className="flex min-w-0 flex-col gap-3">
                    {/* Row 1: Tabs + actions (wide) / Tabs only (narrow) */}
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="min-w-0 shrink-0">
                            <TabsList>
                                {companyTabs.map((tab) => (
                                    <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                                        {tab.label}
                                        <Badge variant={activeTab === tab.value ? 'default' : 'secondary'} className="px-1.5 text-[10px]">
                                            {tabCounts[tab.value] ?? 0}
                                        </Badge>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        {/* Search + actions inline on wide containers */}
                        <div className="ml-auto hidden items-center gap-2 @3xl:flex">
                            <div className="flex items-center gap-2">
                                <Switch id="show-closed" checked={showClosed} onCheckedChange={handleToggleClosed} />
                                <Label htmlFor="show-closed" className="text-muted-foreground text-sm">Show Closed</Label>
                            </div>
                            <div className="relative w-64">
                                <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                            </div>
                            <Link href="/locations/sync" method="get">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                    <RefreshCcw className="h-4 w-4" />
                                    Sync Locations
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Row 2: Search full-width + actions on narrow containers */}
                    <div className="flex flex-col gap-2 @3xl:hidden">
                        <div className="relative w-full">
                            <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Switch id="show-closed-mobile" checked={showClosed} onCheckedChange={handleToggleClosed} />
                                <Label htmlFor="show-closed-mobile" className="text-muted-foreground text-sm whitespace-nowrap">Show Closed</Label>
                            </div>
                            <Link href="/locations/sync" method="get" className="flex-1">
                                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
                                    <RefreshCcw className="h-4 w-4" />
                                    Sync
                                </Button>
                            </Link>
                        </div>
                    </div>
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
                        {/* Card layout for narrow containers */}
                        <div className="@3xl:hidden flex flex-col gap-2">
                            {filteredLocations.map((location) => (
                                <div key={location.id} className={`rounded-lg border p-4 ${location.closed_at ? 'opacity-60' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Link href={`locations/${location.id}`} className="font-medium hover:underline">
                                                    {location.name}
                                                </Link>
                                                {location.closed_at && (
                                                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Closed</Badge>
                                                )}
                                            </div>
                                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                <span className="font-mono">{location.eh_location_id}</span>
                                                {location.external_id && <span className="font-mono">{location.external_id}</span>}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {location.state && <Badge variant="secondary">{location.state}</Badge>}
                                            <LocationActionsMobile location={location} canClose={canClose} onCloseReopen={handleCloseReopen} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Table layout for wide containers */}
                        <div className="hidden rounded-lg border @3xl:block">
                            <Table className="table-fixed">
                                <colgroup>
                                    <col className="w-[10%]" />
                                    <col className="w-[30%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[32%]" />
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
                                        <TableHead>Shift Conditions</TableHead>
                                        <TableHead className="pr-4"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLocations.map((location) => (
                                        <TableRow key={location.id} className={location.closed_at ? 'opacity-60' : ''}>
                                            <TableCell className="text-muted-foreground overflow-hidden truncate pl-4 font-mono text-xs">
                                                {location.eh_location_id}
                                            </TableCell>
                                            <TableCell className="overflow-hidden whitespace-normal font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`locations/${location.id}`} className="hover:underline">
                                                        {location.name}
                                                    </Link>
                                                    {location.closed_at && (
                                                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Closed</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="overflow-hidden truncate">
                                                {location.state && <Badge variant="secondary">{location.state}</Badge>}
                                            </TableCell>
                                            <TableCell className="overflow-hidden truncate">
                                                {location.external_id ? (
                                                    <span className="text-muted-foreground font-mono text-xs">{location.external_id}</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="overflow-hidden whitespace-normal">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    {location.worktypes?.length > 0 ? (
                                                        <>
                                                            {location.worktypes.slice(0, 2).map((worktype) => (
                                                                <Badge key={worktype.eh_worktype_id} variant="outline" className="text-xs font-normal">
                                                                    {worktype.name}
                                                                </Badge>
                                                            ))}
                                                            {location.worktypes.length > 2 && (
                                                                <TooltipProvider delayDuration={200}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Badge variant="outline" className="cursor-default text-xs font-normal">
                                                                                +{location.worktypes.length - 2}
                                                                            </Badge>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="bottom" className="max-w-xs p-3">
                                                                            <p className="mb-2 text-xs font-medium">All Shift Conditions</p>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {location.worktypes.map((worktype) => (
                                                                                    <Badge key={worktype.eh_worktype_id} variant="secondary" className="text-xs">
                                                                                        {worktype.name}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="pr-4">
                                                <LocationActions location={location} canClose={canClose} onCloseReopen={handleCloseReopen} />
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

            {/* Inline overlay for close/reopen — avoids Radix portal issues with Inertia */}
            {closingMessage && (
                <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center">
                    <div className="bg-background flex flex-col items-center gap-2 rounded-lg border p-6 shadow-lg">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-sm font-medium">{closingMessage}</p>
                    </div>
                </div>
            )}

            {/* Close Project Confirmation — inline to avoid Radix portal/aria-hidden issues with Inertia */}
            {closeDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background w-full max-w-md rounded-lg border p-6 shadow-lg">
                        <h2 className="text-lg font-semibold">Close Project</h2>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Are you sure you want to close <strong>{closeDialog.location.name}</strong>? This will hide the project and all its
                            associated data from listing views. You can reopen it later.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setCloseDialog(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmClose}>
                                Close Project
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

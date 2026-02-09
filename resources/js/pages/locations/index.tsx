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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowUpDown,
    CheckCircle2,
    CirclePlus,
    ClockAlert,
    Download,
    EllipsisVertical,
    Eye,
    MapPin,
    Pencil,
    RefreshCcw,
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

function LocationActions({ location }: { location: Location }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href={`locations/${location.id}`}>
                    <DropdownMenuItem className="gap-2">
                        <Eye className="h-4 w-4" />
                        View Details
                    </DropdownMenuItem>
                </Link>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">Material Items</DropdownMenuLabel>
                <Link href={`location/${location.id}/material-items`}>
                    <DropdownMenuItem className="gap-2">
                        <Eye className="h-4 w-4" />
                        View Items
                    </DropdownMenuItem>
                </Link>
                <Link href={`location/${location.id}/material-item-price-list-uploads`}>
                    <DropdownMenuItem className="gap-2">
                        <ClockAlert className="h-4 w-4" />
                        Audit Uploads
                    </DropdownMenuItem>
                </Link>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">Variations</DropdownMenuLabel>
                <Link href={`locations/${location.id}/variations`}>
                    <DropdownMenuItem className="gap-2">
                        <CirclePlus className="h-4 w-4" />
                        Create New
                    </DropdownMenuItem>
                </Link>
                <Link href={`locations/${location.id}/variations`}>
                    <DropdownMenuItem className="gap-2">
                        <Eye className="h-4 w-4" />
                        View All
                    </DropdownMenuItem>
                </Link>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">Requisition</DropdownMenuLabel>
                <Link href={route('location.req-header.edit', { locationId: location.id })}>
                    <DropdownMenuItem className="gap-2">
                        <Pencil className="h-4 w-4" />
                        Edit Header
                    </DropdownMenuItem>
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function LocationsList() {
    const { locations, flash, auth } = usePage<{
        locations: Location[];
        flash: { success?: string; error?: string };
        auth: { user: { roles?: Array<{ name: string }> } };
    }>().props;

    const isLoading = false;
    const [open, setOpen] = useState(isLoading);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('companySelected') ?? 'all');

    const { sortedItems: sortedLocations, handleSort } = useSortableData<Location>(locations, { field: 'name', order: 'asc' });

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        localStorage.setItem('companySelected', value);
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

    const isAdmin = auth?.user?.roles?.some((role) => role.name === 'admin') ?? false;

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

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[200px] max-w-[256px] flex-1">
                            <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                        </div>
                        <Link href="/locations/sync" method="get">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                <RefreshCcw className="h-4 w-4" />
                                Sync Locations
                            </Button>
                        </Link>
                        {isAdmin && (
                            <Link href="/locations/load-job-data" method="get">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                    <Download className="h-4 w-4" />
                                    Load Job Data
                                </Button>
                            </Link>
                        )}
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
                                <div key={location.id} className="rounded-lg border p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <Link href={`locations/${location.id}`} className="font-medium hover:underline">
                                                {location.name}
                                            </Link>
                                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                <span className="font-mono">{location.eh_location_id}</span>
                                                {location.external_id && <span className="font-mono">{location.external_id}</span>}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {location.state && <Badge variant="secondary">{location.state}</Badge>}
                                            <LocationActions location={location} />
                                        </div>
                                    </div>
                                    {location.worktypes?.length > 0 && (
                                        <div className="mt-3 flex flex-wrap items-center gap-1">
                                            {location.worktypes.map((worktype) => (
                                                <Badge key={worktype.eh_worktype_id} variant="outline" className="text-xs font-normal">
                                                    {worktype.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
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
                                        <TableRow key={location.id}>
                                            <TableCell className="text-muted-foreground overflow-hidden truncate pl-4 font-mono text-xs">
                                                {location.eh_location_id}
                                            </TableCell>
                                            <TableCell className="overflow-hidden whitespace-normal font-medium">
                                                <Link href={`locations/${location.id}`} className="hover:underline">
                                                    {location.name}
                                                </Link>
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
                                                <LocationActions location={location} />
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
        </AppLayout>
    );
}

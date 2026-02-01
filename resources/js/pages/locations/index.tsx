import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowUpDown,
    Building2,
    CheckCircle2,
    ChevronRight,
    CirclePlus,
    ClockAlert,
    Download,
    Eye,
    MapPin,
    MoreHorizontal,
    Pencil,
    RefreshCcw,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SelectFilter } from '../purchasing/index-partials/selectFilter';

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

const companyOptions = [
    { value: '1149031', label: 'SWC' },
    { value: '1249093', label: 'SWCP' },
    { value: '1198645', label: 'Greenline' },
];

const stateColorMap: Record<string, string> = {
    NSW: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    VIC: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
    QLD: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    WA: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    SA: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
    TAS: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400',
    NT: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
    ACT: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400',
};

export default function LocationsList() {
    const { locations, flash, auth } = usePage<{
        locations: Location[];
        flash: { success?: string; error?: string };
        auth: { user: { roles?: Array<{ name: string }> } };
    }>().props;

    const isLoading = false;
    const [open, setOpen] = useState(isLoading);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<string | null>(() => localStorage.getItem('companySelected') ?? null);

    const { sortedItems: sortedLocations, handleSort } = useSortableData<Location>(locations, { field: 'name', order: 'asc' });

    const handleCompanyChange = (value: string) => {
        setFilter(value);
        localStorage.setItem('companySelected', value);
    };

    const filteredLocations = useMemo(() => {
        let result = filter ? sortedLocations.filter((location) => location.eh_parent_id === filter) : sortedLocations;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (location) =>
                    location.name.toLowerCase().includes(query) ||
                    location.external_id?.toLowerCase().includes(query) ||
                    location.eh_location_id?.toLowerCase().includes(query),
            );
        }

        return result;
    }, [sortedLocations, filter, searchQuery]);

    const isAdmin = auth?.user?.roles?.some((role) => role.name === 'admin') ?? false;

    const selectedCompanyLabel = companyOptions.find((opt) => opt.value === filter)?.label;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            <MapPin className="text-primary h-6 w-6" />
                            Locations
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Manage and configure your project locations
                            {selectedCompanyLabel && (
                                <Badge variant="secondary" className="ml-2">
                                    {selectedCompanyLabel}
                                </Badge>
                            )}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/locations/sync" method="get">
                            <Button
                                variant="outline"
                                className="gap-2 transition-all hover:border-primary/50"
                                onClick={() => setOpen(true)}
                            >
                                <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                                {isLoading ? 'Syncing...' : 'Sync Locations'}
                            </Button>
                        </Link>
                        {isAdmin && (
                            <Link href="/locations/load-job-data" method="get">
                                <Button
                                    variant="outline"
                                    className="gap-2 transition-all hover:border-primary/50"
                                    onClick={() => setOpen(true)}
                                >
                                    <Download className="h-4 w-4" />
                                    Load Job Data
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Flash Messages */}
                {flash.success && (
                    <Alert className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertTitle className="text-emerald-700 dark:text-emerald-400">Success</AlertTitle>
                        <AlertDescription className="text-emerald-600 dark:text-emerald-300">{flash.success}</AlertDescription>
                    </Alert>
                )}
                {flash.error && (
                    <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{flash.error}</AlertDescription>
                    </Alert>
                )}

                {/* Main Card */}
                <Card className="overflow-hidden border-0 shadow-sm">
                    <CardHeader className="border-b bg-muted/30 px-6 py-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                    All Locations
                                </CardTitle>
                                <CardDescription>
                                    {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''} found
                                </CardDescription>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="relative w-full sm:w-64">
                                    <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="name or ID" />
                                </div>
                                <div className="w-full sm:w-44">
                                    <SelectFilter
                                        value={filter}
                                        options={companyOptions}
                                        filterName="All Companies"
                                        onChange={handleCompanyChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-24 pl-6">ID</TableHead>
                                        <TableHead>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-3 h-8 gap-1 font-medium hover:bg-transparent"
                                                onClick={() => handleSort('name')}
                                            >
                                                Name
                                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="w-24">State</TableHead>
                                        <TableHead>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-3 h-8 gap-1 font-medium hover:bg-transparent"
                                                onClick={() => handleSort('external_id')}
                                            >
                                                External ID
                                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>Shift Conditions</TableHead>
                                        <TableHead className="w-32 text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLocations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center">
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                    <MapPin className="h-8 w-8 opacity-40" />
                                                    <p>No locations found</p>
                                                    {searchQuery && (
                                                        <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                            Clear search
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLocations.map((location, index) => (
                                            <TableRow
                                                key={location.id}
                                                className="group transition-colors hover:bg-muted/50"
                                                style={{ animationDelay: `${index * 20}ms` }}
                                            >
                                                <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                                                    {location.eh_location_id}
                                                </TableCell>
                                                <TableCell>
                                                    <Link
                                                        href={`locations/${location.id}`}
                                                        className="group/link inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                                                    >
                                                        {location.name}
                                                        <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover/link:translate-x-0.5 group-hover/link:opacity-100" />
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    {location.state && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'font-medium transition-transform hover:scale-105',
                                                                stateColorMap[location.state] ||
                                                                    'bg-gray-500/10 text-gray-600 border-gray-500/20',
                                                            )}
                                                        >
                                                            {location.state}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {location.external_id ? (
                                                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                            {location.external_id}
                                                        </code>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm italic">Not set</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {location.worktypes?.length > 0 ? (
                                                            <>
                                                                {location.worktypes.slice(0, 2).map((worktype) => (
                                                                    <Badge
                                                                        key={worktype.eh_worktype_id}
                                                                        variant="secondary"
                                                                        className="text-xs transition-transform hover:scale-105"
                                                                    >
                                                                        {worktype.name}
                                                                    </Badge>
                                                                ))}
                                                                {location.worktypes.length > 2 && (
                                                                    <TooltipProvider delayDuration={200}>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="cursor-pointer text-xs text-muted-foreground transition-all hover:bg-muted"
                                                                                >
                                                                                    +{location.worktypes.length - 2}
                                                                                </Badge>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent
                                                                                side="bottom"
                                                                                className="max-w-xs p-3"
                                                                            >
                                                                                <p className="mb-2 text-xs font-medium">
                                                                                    All Shift Conditions
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {location.worktypes.map((worktype) => (
                                                                                        <Badge
                                                                                            key={worktype.eh_worktype_id}
                                                                                            variant="secondary"
                                                                                            className="text-xs"
                                                                                        >
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
                                                            <span className="text-muted-foreground text-sm italic">None configured</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`locations/${location.id}`}>
                                                            <Button size="sm" className="h-8 gap-1.5 transition-all">
                                                                Open
                                                                <ChevronRight className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </Link>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                                                                >
                                                                    <span className="sr-only">More actions</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
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
                                                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                                                    Material Items
                                                                </DropdownMenuLabel>
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
                                                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                                                    Variations
                                                                </DropdownMenuLabel>
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
                                                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                                                    Requisition
                                                                </DropdownMenuLabel>
                                                                <Link
                                                                    href={route('location.req-header.edit', { locationId: location.id })}
                                                                >
                                                                    <DropdownMenuItem className="gap-2">
                                                                        <Pencil className="h-4 w-4" />
                                                                        Edit Header
                                                                    </DropdownMenuItem>
                                                                </Link>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <LoadingDialog open={open} setOpen={setOpen} />
        </AppLayout>
    );
}

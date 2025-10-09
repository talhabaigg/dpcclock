import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSortableData } from '@/hooks/use-sortable-data';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowUpDown, RefreshCcw } from 'lucide-react';
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
export default function LocationsList() {
    const { locations, flash } = usePage<{ locations: Location[]; flash: { success?: string; error?: string } }>().props;
    const isLoading = false;
    const [open, setOpen] = useState(isLoading);
    const [filter, setFilter] = useState<string | null>(() => localStorage.getItem('companySelected') ?? null);
    const { sortedItems: sortedLocations, handleSort } = useSortableData<Location>(locations); //useSortableData is a custom hook to sort table data
    const handleCompanyChange = (value: string) => {
        setFilter(value);
        localStorage.setItem('companySelected', value);
    };
    const filteredLocations = useMemo(() => {
        return filter ? sortedLocations.filter((location) => location.eh_parent_id === filter) : sortedLocations;
    }, [sortedLocations, filter]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />
            <div className="m-2 mx-auto flex flex-col items-center gap-2 sm:mx-2 sm:flex-row">
                <Link href="/locations/sync" method="get">
                    <Button variant="outline" className="w-full min-w-96 sm:w-full sm:min-w-full" onClick={() => setOpen(true)}>
                        <RefreshCcw /> {isLoading ? 'Syncing...' : 'Sync Locations'}
                    </Button>
                </Link>
                <div className="w-full sm:max-w-48">
                    <SelectFilter
                        value={filter}
                        options={[
                            { value: '1149031', label: 'SWC' },
                            { value: '1249093', label: 'SWCP' },
                            { value: '1198645', label: 'Greenline' },
                        ]}
                        filterName={`Filter by Company`}
                        onChange={(val) => handleCompanyChange(val)}
                    />
                </div>

                <div className="w-full max-w-96 sm:max-w-full">
                    {' '}
                    {flash.success && (
                        <Alert variant="default">
                            <AlertCircle />
                            <AlertTitle>Success!</AlertTitle>
                            <AlertDescription>{flash.success}</AlertDescription>
                        </Alert>
                    )}
                    {flash.error && (
                        <Alert variant="default">
                            <AlertCircle />
                            <AlertTitle>Error!</AlertTitle>
                            <AlertDescription>{flash.error}</AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>
            <LoadingDialog open={open} setOpen={setOpen} />

            <Card className="mx-auto max-w-96 p-0 sm:max-w-full md:mx-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>
                                <div className="flex items-center">
                                    {' '}
                                    <Label>Name</Label>{' '}
                                    <Button size="sm" variant="ghost" onClick={() => handleSort('name')}>
                                        <ArrowUpDown className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableHead>
                            <TableHead>
                                <Label>State</Label>
                            </TableHead>
                            <TableHead>
                                {' '}
                                <div className="flex items-center">
                                    {' '}
                                    <Label>External ID</Label>{' '}
                                    <Button size="sm" variant="ghost" onClick={() => handleSort('external_id')}>
                                        <ArrowUpDown className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableHead>
                            <TableHead>Default Shift Conditions</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLocations.map((location) => (
                            <TableRow key={location.id}>
                                <TableCell>{location.eh_location_id}</TableCell>

                                <TableCell>{location.name}</TableCell>
                                <TableCell>{location.state && <Badge>{location.state}</Badge>}</TableCell>
                                <TableCell>{location.external_id || 'Not Set'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                        {location.worktypes?.length > 0 ? (
                                            <>
                                                {location.worktypes.slice(0, 3).map((worktype) => (
                                                    <Badge key={worktype.eh_worktype_id}>{worktype.name}</Badge>
                                                ))}

                                                {location.worktypes.length > 3 && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="outline" className="text-muted-foreground cursor-pointer">
                                                                    +{location.worktypes.length - 3} more
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-sm p-2">
                                                                <div className="flex max-w-sm flex-wrap gap-1">
                                                                    {location.worktypes.slice(3).map((worktype) => (
                                                                        <Badge key={worktype.eh_worktype_id} variant="secondary">
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
                                            'No default shift conditions'
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href={`locations/${location.id}`}>
                                        <Button>Open</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </AppLayout>
    );
}

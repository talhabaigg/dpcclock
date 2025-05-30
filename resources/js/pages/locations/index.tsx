import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
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

// type PaginatedLocations = {
//     data: Location[];
//     current_page: number;
//     last_page: number;
//     per_page: number;
//     total: number;
//     next_page_url: string | null;
//     prev_page_url: string | null;
// };
export default function LocationsList() {
    const { locations, flash } = usePage<{ locations: Location[]; flash: { success?: string } }>().props;
    const isLoading = false;
    // const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filter, setFilter] = useState<string | null>(null);
    const filteredLocations = filter ? locations.filter((location) => location.eh_parent_id === filter) : locations;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />
            <div className="m-2 flex items-center gap-2">
                <Link href="/locations/sync" method="get">
                    <Button variant="outline" className="w-32">
                        {isLoading ? 'Syncing...' : 'Sync Locations'}
                    </Button>
                </Link>
                <div>
                    <SelectFilter
                        options={[
                            { value: '1149031', label: 'SWC' },
                            { value: '1198645', label: 'Greenline' },
                        ]}
                        filterName={`Filter by Company`}
                        onChange={(val) => setFilter(val)}
                    />
                </div>

                {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}
            </div>

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>External ID</TableHead>
                            <TableHead className="hidden sm:flex">Default Shift Conditions</TableHead>
                            <TableHead>Actions</TableHead>
                            {/* <TableHead>Upload CSV</TableHead> */}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLocations.map((location) => (
                            <TableRow key={location.id}>
                                <TableCell>{location.eh_location_id}</TableCell>

                                <TableCell>{location.name}</TableCell>
                                <TableCell>{location.external_id || 'Not Set'}</TableCell>
                                <TableCell className="hidden sm:flex">
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
                                    {/* <SublocationDialog subLocations={location.subLocations} locationName={location.name}></SublocationDialog> */}
                                </TableCell>
                                {/* <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Input type="file" accept=".csv" onChange={handleFileChange} />
                                        <Button onClick={() => handleUpload(location.id)} disabled={!selectedFile || processing}>
                                            Upload CSV
                                        </Button>
                                    </div>
                                </TableCell> */}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {/* <PaginationComponent pagination={locations} /> */}
            </div>
        </AppLayout>
    );
}

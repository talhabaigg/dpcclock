import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { usePage } from '@inertiajs/react';
import { FolderTree } from 'lucide-react';

type Location = LocationBase & {
    subLocations: Array<{
        id: number;
        name: string;
        eh_location_id: string;
        external_id: string;
    }>;
};

const splitExternalId = (externalId: string) => {
    if (!externalId) {
        return { level: 'Not Set', activity: 'Not Set' };
    }
    const trimmedId = externalId.split('::').pop() || '';
    const parts = trimmedId.split('-');
    const level = parts[0] ? parts[0] : 'Not Set';
    const activity = parts[1] ? parts[1] : 'Not Set';
    return { level, activity };
};

export default function LocationShow() {
    const { location } = usePage<{ location: Location }>().props;

    return (
        <LocationLayout location={location} activeTab="sublocations">
            <Card>
                <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                    <CardTitle className="text-base">Sub-locations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="hidden md:table-cell">External ID</TableHead>
                                    <TableHead className="hidden sm:table-cell">Level</TableHead>
                                    <TableHead className="hidden sm:table-cell pr-3 sm:pr-6">Activity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {location.subLocations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                <FolderTree className="h-8 w-8 opacity-40" />
                                                <p>No sub-locations found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    location.subLocations.map((subLocation) => (
                                        <TableRow key={subLocation.id}>
                                            <TableCell className="text-muted-foreground pl-3 font-mono text-xs sm:pl-6">
                                                {subLocation.eh_location_id}
                                            </TableCell>
                                            <TableCell className="font-medium">{subLocation.name}</TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {subLocation.external_id ? (
                                                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                                                        {subLocation.external_id}
                                                    </code>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm italic">Not set</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {splitExternalId(subLocation.external_id).level}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden pr-3 sm:table-cell sm:pr-6">
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {splitExternalId(subLocation.external_id).activity}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </LocationLayout>
    );
}

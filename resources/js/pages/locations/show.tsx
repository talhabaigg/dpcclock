import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, Download, FolderTree, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';

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

/** Extract the suffix after :: from external_id (e.g. "Level 01-007_CARP_3RD" from "COA00::Level 01-007_CARP_3RD") */
const extractSuffix = (externalId: string): string | null => {
    if (!externalId || !externalId.includes('::')) return null;
    const suffix = externalId.split('::').pop() || '';
    return suffix || null;
};

export default function LocationShow() {
    const { location, dpcKeys } = usePage<{ location: Location; dpcKeys: string[] }>().props;

    const dpcValidation = useMemo(() => {
        if (!dpcKeys || dpcKeys.length === 0) return null;

        const dpcSet = new Set(dpcKeys.map((k) => k.trim()));
        const issues: Array<{ id: number; name: string; external_id: string; suffix: string; issue: string }> = [];

        for (const sub of location.subLocations) {
            const suffix = extractSuffix(sub.external_id);
            if (!suffix) continue;
            if (!dpcSet.has(suffix)) {
                issues.push({
                    id: sub.id,
                    name: sub.name,
                    external_id: sub.external_id,
                    suffix,
                    issue: `"${suffix}" not found in DPC report`,
                });
            }
        }

        return { issues, totalChecked: location.subLocations.filter((s) => extractSuffix(s.external_id)).length };
    }, [location.subLocations, dpcKeys]);

    return (
        <LocationLayout location={location} activeTab="sublocations">
            <Tabs defaultValue="sublocations" className="flex flex-col">
                <TabsList>
                    <TabsTrigger value="sublocations">
                        <FolderTree className="h-3.5 w-3.5" />
                        Sub-locations
                    </TabsTrigger>
                    <TabsTrigger value="code">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        DPC Validation{' '}
                        {dpcValidation && dpcValidation.issues.length > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                                {dpcValidation.issues.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="sublocations">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
                            <CardTitle className="text-base">Sub-locations</CardTitle>
                            {location.external_id && (
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`/locations/external-id-report?job=${encodeURIComponent(location.external_id.replace(/:+$/, ''))}`}>
                                        <Download className="mr-1.5 h-3.5 w-3.5" />
                                        Validation Report
                                    </a>
                                </Button>
                            )}
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
                                            <TableHead className="hidden pr-3 sm:table-cell sm:pr-6">Activity</TableHead>
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
                </TabsContent>
                <TabsContent value="code">
                    <Card>
                        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-base">DPC Cost Code Validation</CardTitle>
                                    {dpcValidation ? (
                                        dpcValidation.issues.length === 0 ? (
                                            <Badge variant="default" className="gap-1 text-xs">
                                                <CheckCircle className="h-3 w-3" />
                                                All matched
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive" className="gap-1 text-xs">
                                                <AlertTriangle className="h-3 w-3" />
                                                {dpcValidation.issues.length} unmatched
                                            </Badge>
                                        )
                                    ) : null}
                                </div>
                                {dpcValidation && (
                                    <span className="text-muted-foreground text-xs">
                                        {dpcValidation.totalChecked} sub-locations checked against {dpcKeys.length} DPC codes
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!dpcValidation ? (
                                <div className="flex flex-col items-center gap-2 py-12 text-center">
                                    <ShieldCheck className="text-muted-foreground h-8 w-8 opacity-40" />
                                    <p className="text-muted-foreground text-sm">
                                        No DPC data uploaded yet. Upload a DPC CSV in the DPC Data tab to enable validation.
                                    </p>
                                </div>
                            ) : dpcValidation.issues.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-12 text-center">
                                    <CheckCircle className="h-8 w-8 text-green-500 opacity-60" />
                                    <p className="text-muted-foreground text-sm">All sub-location codes match DPC report data.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-3 sm:pl-6">Sub-location</TableHead>
                                                <TableHead>External ID</TableHead>
                                                <TableHead>DPC Key (Area-Code)</TableHead>
                                                <TableHead className="pr-3 sm:pr-6">Issue</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dpcValidation.issues.map((issue) => (
                                                <TableRow key={issue.id}>
                                                    <TableCell className="pl-3 font-medium sm:pl-6">{issue.name}</TableCell>
                                                    <TableCell>
                                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{issue.external_id}</code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="destructive" className="font-mono text-xs">
                                                            {issue.suffix}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground pr-3 text-sm sm:pr-6">{issue.issue}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </LocationLayout>
    );
}

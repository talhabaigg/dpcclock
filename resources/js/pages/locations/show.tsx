import LocationPageHeader from '@/components/location-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { Head, usePage } from '@inertiajs/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, CheckCircle, Download, FolderTree, ShieldCheck } from 'lucide-react';
import { useMemo, useRef } from 'react';

const SUBLOC_COLUMN_COUNT = 4;
const ROW_HEIGHT = 32;

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

    const subLocations = location.subLocations ?? [];

    const subLocScrollRef = useRef<HTMLDivElement>(null);
    const subLocVirtualizer = useVirtualizer({
        count: subLocations.length,
        getScrollElement: () => subLocScrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10,
    });

    const subLocVirtualItems = subLocVirtualizer.getVirtualItems();
    const subLocTotalSize = subLocVirtualizer.getTotalSize();
    const subLocPaddingTop = subLocVirtualItems[0]?.start ?? 0;
    const subLocPaddingBottom = subLocTotalSize - (subLocVirtualItems[subLocVirtualItems.length - 1]?.end ?? 0);

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
            <Head title={location.name} />
            <Tabs defaultValue="sublocations" className="flex flex-col gap-3">
                <TabsList>
                    <TabsTrigger value="sublocations" className="text-xs">
                        <FolderTree className="h-3.5 w-3.5" />
                        Sub-locations
                    </TabsTrigger>
                    <TabsTrigger value="code" className="text-xs">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        DPC Validation{' '}
                        {dpcValidation && dpcValidation.issues.length > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                                {dpcValidation.issues.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sublocations" className="flex flex-col gap-3">
                    <LocationPageHeader location={location} title="Sub-locations">
                        {location.external_id && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={`/locations/external-id-report?job=${encodeURIComponent(location.external_id.replace(/:+$/, ''))}`}>
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                    Validation Report
                                </a>
                            </Button>
                        )}
                    </LocationPageHeader>
                    <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
                        <span>{subLocations.length.toLocaleString()} sub-locations</span>
                    </div>
                    <Card className="py-0">
                        <CardContent className="p-0">
                            <TooltipProvider delay={200}>
                                <div ref={subLocScrollRef} className="h-[calc(100vh-300px)] min-h-[320px] overflow-auto">
                                    <Table className="text-xs [&_td]:h-8 [&_td]:py-0 [&_th]:h-8 [&_th]:py-0">
                                        <TableHeader className="bg-card sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)]">
                                            <TableRow>
                                                <TableHead className="pl-3 sm:pl-6">ID</TableHead>
                                                <TableHead className="hidden md:table-cell">External ID</TableHead>
                                                <TableHead className="hidden sm:table-cell">Level</TableHead>
                                                <TableHead className="hidden pr-3 sm:table-cell sm:pr-6">Activity</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {subLocations.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={SUBLOC_COLUMN_COUNT} className="h-32 text-center">
                                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                            <FolderTree className="h-8 w-8 opacity-40" />
                                                            <p>No sub-locations found</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                <>
                                                    {subLocPaddingTop > 0 && (
                                                        <tr aria-hidden style={{ height: subLocPaddingTop }}>
                                                            <td colSpan={SUBLOC_COLUMN_COUNT} />
                                                        </tr>
                                                    )}
                                                    {subLocVirtualItems.map((vi) => {
                                                        const subLocation = subLocations[vi.index];
                                                        const { level, activity } = splitExternalId(subLocation.external_id);
                                                        return (
                                                            <TableRow key={subLocation.id}>
                                                                <TableCell className="text-muted-foreground pl-3 font-mono text-xs sm:pl-6">
                                                                    {subLocation.eh_location_id}
                                                                </TableCell>
                                                                <TableCell className="hidden whitespace-nowrap md:table-cell">
                                                                    {subLocation.external_id ? (
                                                                        <span className="font-mono">{subLocation.external_id}</span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground italic">Not set</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="hidden max-w-[140px] sm:table-cell">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="block truncate font-mono">{level}</span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{level}</TooltipContent>
                                                                    </Tooltip>
                                                                </TableCell>
                                                                <TableCell className="hidden max-w-[160px] pr-3 sm:table-cell sm:pr-6">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="block truncate font-mono">{activity}</span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{activity}</TooltipContent>
                                                                    </Tooltip>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {subLocPaddingBottom > 0 && (
                                                        <tr aria-hidden style={{ height: subLocPaddingBottom }}>
                                                            <td colSpan={SUBLOC_COLUMN_COUNT} />
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TooltipProvider>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="code" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold">DPC Cost Code Validation</h2>
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
                    <Card className="py-0">
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
                                    <Table className="text-xs">
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
                                                    <TableCell className="text-muted-foreground pr-3 sm:pr-6">{issue.issue}</TableCell>
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

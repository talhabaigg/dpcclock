import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { Link, usePage } from '@inertiajs/react';
import { Code2, Edit, RefreshCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

type Location = LocationBase & {
    cost_codes: Array<{
        id: number;
        code: string;
        description: string;
    }>;
};

export default function LocationCostCodes() {
    const { location } = usePage<{ location: Location }>().props;
    const [open, setOpen] = useState(false);

    return (
        <LocationLayout location={location} activeTab="cost-codes">
            <LoadingDialog open={open} setOpen={setOpen} message="Loading..." />
            <Card>
                <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">Cost Codes</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            <Link href={`/location/${location.id}/cost-codes/sync`} method="get">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                    <RefreshCcw className="h-4 w-4" />
                                    <span className="hidden sm:inline">Sync from Premier</span>
                                </Button>
                            </Link>
                            <Link href={`/location/${location.id}/cost-codes/edit`}>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Edit className="h-4 w-4" />
                                    <span className="hidden sm:inline">Edit Ratios</span>
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-20 pr-3 text-right sm:pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {location.cost_codes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-32 text-center">
                                            <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                <Code2 className="h-8 w-8 opacity-40" />
                                                <p>No cost codes available</p>
                                                <Link href={`/location/${location.id}/cost-codes/sync`} method="get">
                                                    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                                                        <RefreshCcw className="mr-2 h-4 w-4" />
                                                        Sync from Premier
                                                    </Button>
                                                </Link>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    location.cost_codes.map((costCode) => (
                                        <TableRow key={costCode.id} className="group">
                                            <TableCell className="pl-3 sm:pl-6">
                                                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                    {costCode.code}
                                                </code>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{costCode.description}</TableCell>
                                            <TableCell className="pr-3 text-right sm:pr-6">
                                                <Link href={`/locations/${location.id}/cost-codes/${costCode.id}/delete`}>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-0 transition-all group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </Link>
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

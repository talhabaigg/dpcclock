import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { usePage } from '@inertiajs/react';
import { Download, Heart } from 'lucide-react';
import FavouriteMaterialUploader from './partials.tsx/favMaterialUploader';

type Location = LocationBase & {
    favourite_materials: Array<{
        id: number;
        code: string;
        description: string;
    }>;
};

export default function LocationFavourites() {
    const { location } = usePage<{ location: Location }>().props;

    return (
        <LocationLayout location={location} activeTab="favourites">
            <Card>
                <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">Favorite Materials</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            <FavouriteMaterialUploader locationId={location.id} />
                            <a href={`/location/${location.id}/favourite-materials/download-csv`}>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Download CSV</span>
                                </Button>
                            </a>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">Code</TableHead>
                                    <TableHead className="pr-3 sm:pr-6">Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!location.favourite_materials || location.favourite_materials.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-32 text-center">
                                            <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                <Heart className="h-8 w-8 opacity-40" />
                                                <p>No favorite materials</p>
                                                <p className="text-xs">Import a CSV to add favorites</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    location.favourite_materials.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="pl-3 sm:pl-6">
                                                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                    {item.code}
                                                </code>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground pr-3 sm:pr-6">{item.description}</TableCell>
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

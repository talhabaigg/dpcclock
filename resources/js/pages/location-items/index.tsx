import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { locationMaterialItemColumns } from './index-partials/columns';
import { DataTable } from './index-partials/data-table';

const LocationMaterialItemsIndex = ({ location }) => {
    console.log(location);
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: `${location.name}`,
            href: `/locations/${location.id}`,
        },
        {
            title: 'Material Items',
            href: `/location/${location.id}/material-items`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="sm:ml-2">
                <ScrollArea className="mx-auto mt-1 h-[200px] max-w-96 rounded-md border p-0 sm:mx-0">
                    <Table className="p-0">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Supplier Code</TableHead>
                                <TableHead>Count</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {location.material_items.length > 0 ? (
                                Object.entries(
                                    location.material_items.reduce(
                                        (acc: Record<string, number>, item: { supplier?: { code?: string } }) => {
                                            const supplierCode = item.supplier?.code ?? 'NO SUPPLIER';

                                            if (!acc[supplierCode]) {
                                                acc[supplierCode] = 0;
                                            }

                                            acc[supplierCode] += 1;

                                            return acc;
                                        },
                                        {} as Record<string, number>,
                                    ),
                                )
                                    .sort(([a], [b]) => a.localeCompare(b)) // optional: sort by supplier code
                                    .map(([supplierCode, count]) => (
                                        <TableRow key={supplierCode}>
                                            <TableCell className="font-thin">{supplierCode}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{count as number}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center">
                                        No material items found.
                                    </TableCell>
                                </TableRow>
                            )}

                            {location.material_items.length > 0 && (
                                <TableRow className="border-t">
                                    <TableCell className="font-medium">Total</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{location.material_items.length}</Badge>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <div className="sm:mx-2">
                <div className="mx-auto my-2 max-w-96 overflow-auto sm:max-w-full sm:min-w-full">
                    <DataTable columns={locationMaterialItemColumns} data={location.material_items} />
                </div>
            </div>
        </AppLayout>
    );
};

export default LocationMaterialItemsIndex;

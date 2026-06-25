import LoadingDialog from '@/components/loading-dialog';
import LocationPageHeader from '@/components/location-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Code2, Edit, EllipsisVertical, RefreshCcw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

type Location = LocationBase & {
    cost_codes: Array<{
        id: number;
        code: string;
        description: string;
    }>;
};

const COLUMN_COUNT = 3;
const ROW_HEIGHT = 32;

export default function LocationCostCodes() {
    const { location } = usePage<{ location: Location }>().props;
    const [open, setOpen] = useState(false);

    const items = location.cost_codes ?? [];

    const scrollRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10,
    });

    const virtualItems = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();
    const paddingTop = virtualItems[0]?.start ?? 0;
    const paddingBottom = totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);

    const isEmpty = items.length === 0;

    return (
        <LocationLayout location={location} activeTab="cost-codes">
            <Head title={`Cost Codes - ${location.name}`} />
            <LoadingDialog open={open} setOpen={setOpen} message="Loading..." />

            <LocationPageHeader location={location} title="Cost Codes">
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
            </LocationPageHeader>

            <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
                <span>{items.length.toLocaleString()} cost codes</span>
            </div>

            <Card className="py-0">
                <CardContent className="p-0">
                    <div ref={scrollRef} className="h-[calc(100vh-260px)] min-h-[320px] overflow-auto">
                        <Table className="text-xs [&_td]:h-8 [&_td]:py-0 [&_th]:h-8 [&_th]:py-0">
                            <TableHeader className="bg-card sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)]">
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-10 pr-3 sm:pr-6"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isEmpty ? (
                                    <TableRow>
                                        <TableCell colSpan={COLUMN_COUNT} className="h-32 text-center">
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
                                    <>
                                        {paddingTop > 0 && (
                                            <tr aria-hidden style={{ height: paddingTop }}>
                                                <td colSpan={COLUMN_COUNT} />
                                            </tr>
                                        )}
                                        {virtualItems.map((vi) => {
                                            const costCode = items[vi.index];
                                            return (
                                                <TableRow key={costCode.id}>
                                                    <TableCell className="pl-3 font-mono whitespace-nowrap sm:pl-6">{costCode.code}</TableCell>
                                                    <TableCell className="text-muted-foreground">{costCode.description}</TableCell>
                                                    <TableCell className="pr-3 text-right sm:pr-6">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-muted-foreground hover:text-foreground h-7 w-7"
                                                                >
                                                                    <EllipsisVertical className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="min-w-32">
                                                                <DropdownMenuItem asChild>
                                                                    <Link
                                                                        href={`/locations/${location.id}/cost-codes/${costCode.id}/delete`}
                                                                        className="text-destructive focus:text-destructive gap-2"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                        Delete
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {paddingBottom > 0 && (
                                            <tr aria-hidden style={{ height: paddingBottom }}>
                                                <td colSpan={COLUMN_COUNT} />
                                            </tr>
                                        )}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </LocationLayout>
    );
}

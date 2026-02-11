import InputSearch from '@/components/inputSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CirclePlus, Copy, Download, EllipsisVertical, Pencil, Send, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Variations', href: '/variations' }];

interface Variation {
    id: number;
    co_number: string;
    co_date: string;
    status: string;
    description: string;
    type: string;
    total_cost: number;
    total_revenue: number;
    location?: { name: string };
}

const isSentOrApproved = (status: string) => status === 'sent' || status === 'Approved';

function VariationActions({ variation, onClose }: { variation: Variation; onClose?: () => void }) {
    const locked = isSentOrApproved(variation.status);

    const handleAction = (action: () => void) => {
        onClose?.();
        action();
    };

    return (
        <>
            <a href={`/variations/${variation.id}/download/excel`} className="block">
                <Button variant="ghost" className="w-full justify-start gap-2 px-3">
                    <Download className="h-4 w-4" />
                    Download Excel
                </Button>
            </a>
            <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3"
                disabled={locked}
                onClick={() =>
                    handleAction(() => {
                        if (locked) return;
                        router.visit(`/variations/${variation.id}/edit`);
                    })
                }
            >
                <Pencil className="h-4 w-4" />
                Edit
            </Button>
            <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3"
                onClick={() =>
                    handleAction(() => {
                        if (confirm('Are you sure you want to duplicate this variation?')) {
                            router.visit(`/variations/${variation.id}/duplicate`);
                        }
                    })
                }
            >
                <Copy className="h-4 w-4" />
                Duplicate
            </Button>
            <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3"
                disabled={locked}
                onClick={() =>
                    handleAction(() => {
                        if (locked) {
                            alert('This variation has already been sent to Premier.');
                            return;
                        }
                        if (confirm('Are you sure you want to send this variation to Premier?')) {
                            router.visit(`/variations/${variation.id}/send-to-premier`);
                        }
                    })
                }
            >
                <Send className="h-4 w-4" />
                Send to Premier
            </Button>
            <div className="my-1 h-px bg-border" />
            <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 text-destructive hover:text-destructive"
                onClick={() =>
                    handleAction(() => {
                        if (confirm('Are you sure you want to delete this variation?')) {
                            router.visit(`/variations/${variation.id}`);
                        }
                    })
                }
            >
                <Trash className="h-4 w-4" />
                Delete
            </Button>
        </>
    );
}

const VariationIndex = ({ variations }: { variations: Variation[] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sheetVariation, setSheetVariation] = useState<Variation | null>(null);

    const filteredVariations = useMemo(() => {
        return searchQuery ? variations.filter((v) => v.co_number.toLowerCase().includes(searchQuery.toLowerCase())) : variations;
    }, [variations, searchQuery]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Variations" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="variation #" />
                    </div>
                    <Link href="/variations/create">
                        <Button size="sm" className="gap-2">
                            <CirclePlus className="h-4 w-4" />
                            Create New
                        </Button>
                    </Link>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredVariations.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">No variations found.</div>
                    ) : (
                        filteredVariations.map((variation) => (
                            <div key={variation.id} className="rounded-lg border p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge>{variation.co_number}</Badge>
                                            <span className="text-muted-foreground text-xs">{variation.status}</span>
                                        </div>
                                        <p className="text-muted-foreground mt-1 truncate text-xs">{variation.description}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSheetVariation(variation)}>
                                        <EllipsisVertical className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                                    {variation.location && <span>{variation.location.name}</span>}
                                    <span>{new Date(variation.co_date).toLocaleDateString('en-GB')}</span>
                                    <span>{variation.type}</span>
                                </div>
                                <div className="mt-2 flex gap-3 text-xs">
                                    <span>Cost: ${variation.total_cost.toFixed(2)}</span>
                                    <span>Revenue: ${variation.total_revenue.toFixed(2)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3">VAR #</TableHead>
                                <TableHead className="px-3">Location/Job</TableHead>
                                <TableHead className="px-3">Date</TableHead>
                                <TableHead className="px-3">Status</TableHead>
                                <TableHead className="px-3">Description</TableHead>
                                <TableHead className="px-3">Type</TableHead>
                                <TableHead className="px-3">Cost</TableHead>
                                <TableHead className="px-3">Revenue</TableHead>
                                <TableHead className="w-[60px] px-3" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredVariations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <p>No variations found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredVariations.map((variation) => (
                                    <TableRow key={variation.id}>
                                        <TableCell className="px-3">
                                            <Badge>{variation.co_number}</Badge>
                                        </TableCell>
                                        <TableCell className="px-3">{variation.location?.name}</TableCell>
                                        <TableCell className="px-3">{new Date(variation.co_date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="px-3">{variation.status}</TableCell>
                                        <TableCell className="px-3">{variation.description}</TableCell>
                                        <TableCell className="px-3">{variation.type}</TableCell>
                                        <TableCell className="px-3">${variation.total_cost.toFixed(2)}</TableCell>
                                        <TableCell className="px-3">${variation.total_revenue.toFixed(2)}</TableCell>
                                        <TableCell className="px-3">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <EllipsisVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem asChild>
                                                        <a href={`/variations/${variation.id}/download/excel`}>
                                                            <Download className="h-4 w-4" />
                                                            Download Excel
                                                        </a>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={isSentOrApproved(variation.status)}
                                                        onClick={() => router.visit(`/variations/${variation.id}/edit`)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to duplicate this variation?')) {
                                                                router.visit(`/variations/${variation.id}/duplicate`);
                                                            }
                                                        }}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        Duplicate
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={isSentOrApproved(variation.status)}
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to send this variation to Premier?')) {
                                                                router.visit(`/variations/${variation.id}/send-to-premier`);
                                                            }
                                                        }}
                                                    >
                                                        <Send className="h-4 w-4" />
                                                        Send to Premier
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to delete this variation?')) {
                                                                router.visit(`/variations/${variation.id}`);
                                                            }
                                                        }}
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Mobile action sheet */}
            <Sheet open={!!sheetVariation} onOpenChange={(open) => !open && setSheetVariation(null)}>
                <SheetContent side="bottom" className="rounded-t-xl">
                    <SheetHeader>
                        <SheetTitle>{sheetVariation?.co_number} Actions</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-1 pb-4">
                        {sheetVariation && <VariationActions variation={sheetVariation} onClose={() => setSheetVariation(null)} />}
                    </div>
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
};

export default VariationIndex;

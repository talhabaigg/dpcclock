import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link } from '@inertiajs/react';
import { CirclePlus, Copy, Download, Pencil, Send, Trash } from 'lucide-react';
import { useState } from 'react';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Variations',
        href: '/variations',
    },
];

const VariationIndex = ({ variations }) => {
    const isLoading = false;
    const [open, setOpen] = useState(isLoading);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Link href="/variations/create" className="flex items-center gap-2">
                            <CirclePlus size={12} />
                            Create New
                        </Link>
                    </Button>
                    {/* <Link href="/variations/sync">
                        <Button variant="outline" className="w-full min-w-96 sm:w-full sm:min-w-full" onClick={() => setOpen(true)}>
                            <RefreshCcw /> {isLoading ? 'Loading...' : 'Load Variations from Premier'}
                        </Button>
                    </Link> */}
                </div>
            </div>
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="p-2">
                <Card className="4xl:max-w-4xl mx-auto mt-4 max-w-sm p-1 text-sm sm:max-w-full">
                    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl">
                        <Table>
                            <TableHeader className="rounded-t-xl hover:rounded-t-xl">
                                <TableRow>
                                    <TableHead>VAR #</TableHead>
                                    <TableHead className="">Location/Job</TableHead>
                                    <TableHead className=""> Variation Date</TableHead>
                                    <TableHead className="">Status</TableHead>
                                    <TableHead className="">Description</TableHead>
                                    <TableHead className="">Type</TableHead>
                                    <TableHead className="">Cost</TableHead>
                                    <TableHead className="">Revenue</TableHead>
                                    <TableHead className="">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variations.map((variation) => (
                                    <TableRow key={variation.id}>
                                        <TableCell>
                                            <Badge>{variation.co_number}</Badge>
                                        </TableCell>
                                        <TableCell>{variation.location?.name}</TableCell>
                                        <TableCell>{new Date(variation.co_date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell>{variation.status}</TableCell>
                                        <TableCell>{variation.description}</TableCell>
                                        <TableCell>{variation.type}</TableCell>
                                        <TableCell>${variation.total_cost.toFixed(2)}</TableCell>
                                        <TableCell>${variation.total_revenue.toFixed(2)}</TableCell>
                                        <TableCell className="space-x-1">
                                            <a href={`/variations/${variation.id}/download/excel`}>
                                                <Button title="Download as Excel" variant="outline" className="cursor-pointer">
                                                    <Download />
                                                </Button>
                                            </a>
                                            <Link
                                                href={`/variations/${variation.id}`}
                                                onClick={(e) => {
                                                    if (!confirm('Are you sure you want to delete this variation?')) {
                                                        e.preventDefault(); // stop navigation only if cancelled
                                                    }
                                                }}
                                            >
                                                <Button title="Delete Variation" variant="outline" className="cursor-pointer">
                                                    <Trash />
                                                </Button>
                                            </Link>
                                            <Link
                                                href={`/variations/${variation.id}/duplicate`}
                                                onClick={(e) => {
                                                    if (!confirm('Are you sure you want to duplicate this variation?')) {
                                                        e.preventDefault(); // stop navigation only if cancelled
                                                    }
                                                }}
                                            >
                                                <Button title="Duplicate Variation" variant="outline" className="cursor-pointer">
                                                    <Copy />
                                                </Button>
                                            </Link>
                                            <Link
                                                disabled={variation.status === 'sent'}
                                                href={`/variations/${variation.id}/edit`}
                                                onClick={(e) => {
                                                    if (variation.status === 'sent') {
                                                        e.preventDefault();
                                                        alert('This variation has already been sent to Premier.');
                                                    } else {
                                                        confirm('Are you sure you want to edit this variation to Premier?');
                                                    }
                                                }}
                                            >
                                                <Button
                                                    title="Edit Variation"
                                                    variant="outline"
                                                    disabled={variation.status === 'sent'}
                                                    className="cursor-pointer"
                                                >
                                                    <Pencil />
                                                </Button>
                                            </Link>
                                            <Link
                                                href={`/variations/${variation.id}/send-to-premier`}
                                                onClick={(e) => {
                                                    if (variation.status === 'sent') {
                                                        e.preventDefault();
                                                        alert('This variation has already been sent to Premier.');
                                                    } else {
                                                        confirm('Are you sure you want to send this variation to Premier?');
                                                    }
                                                }}
                                            >
                                                <Button title="Send to Premier" variant="outline" disabled={variation.status === 'sent'}>
                                                    <Send />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
};

export default VariationIndex;

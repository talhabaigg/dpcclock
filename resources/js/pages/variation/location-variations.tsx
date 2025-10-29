import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertCircleIcon, CircleCheck, CirclePlus, Copy, Download, Pencil, RefreshCcw, Send, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
const LocationVariations = ({ location, flash }) => {
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: location.name,
            href: `/locations/${location.id}`,
        },
        {
            title: 'Variations',
            href: '/locations/variations',
        },
    ];
    const variations = location.variations;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredVariations = useMemo(() => {
        return searchQuery ? variations.filter((variation) => variation.co_number.toLowerCase().includes(searchQuery.toLowerCase())) : variations;
    }, [variations, searchQuery]);
    console.log(flash.error);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />
            <LoadingDialog open={open} setOpen={setOpen} />
            {flash.error && (
                <Alert
                    variant="destructive"
                    className="m-2 mx-auto mt-1 max-w-96 justify-start gap-2 p-2 text-sm sm:mx-2 sm:max-w-2xl sm:flex-row md:justify-between"
                >
                    <AlertCircleIcon />
                    <AlertTitle className="mt-1">{flash.error.message}</AlertTitle>
                    {flash.error.response && <AlertDescription className="whitespace-pre-wrap">{flash.error.response}</AlertDescription>}
                </Alert>
            )}
            {flash.success && (
                <Alert
                    variant="default"
                    className="m-2 mx-auto mt-1 max-w-96 items-center justify-start gap-2 border-green-700 p-2 text-sm sm:mx-2 sm:max-w-2xl sm:flex-row md:justify-between"
                >
                    <CircleCheck color="#388E3C " />
                    <AlertTitle className="mt-1 text-green-700">{flash.success}</AlertTitle>
                </Alert>
            )}
            <div className="items-left m-2 flex flex-col justify-start gap-2 sm:flex-row md:justify-between">
                <div className="relative mx-auto max-w-96 min-w-96 space-x-1 sm:mx-0 sm:w-1/4">
                    <Button variant="outline">
                        <Link href="/variations/create" className="flex items-center gap-2">
                            <CirclePlus size={12} />
                            Create New
                        </Link>
                    </Button>
                    <Button variant="outline">
                        {' '}
                        <Link href={`/locations/${location.id}/variations/sync`} className="flex items-center gap-2" onClick={() => setOpen(true)}>
                            <RefreshCcw size={12} />
                            Sync
                        </Link>
                    </Button>
                </div>
                <div className="relative mx-auto max-w-96 min-w-96 sm:mx-0 sm:w-1/4">
                    <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="Variation #" />
                </div>
            </div>

            <div className="p-2">
                <Card className="4xl:max-w-4xl mx-auto mt-1 max-w-sm p-1 text-sm sm:max-w-full">
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
                                {filteredVariations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center">
                                            No variations found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredVariations.map((variation) => (
                                        <TableRow key={variation.id}>
                                            <TableCell>
                                                <Badge>{variation.co_number}</Badge>
                                            </TableCell>
                                            <TableCell>{location.name}</TableCell>
                                            <TableCell>{new Date(variation.co_date).toLocaleDateString('en-GB')}</TableCell>
                                            <TableCell>{variation.status}</TableCell>
                                            <TableCell>{variation.description}</TableCell>
                                            <TableCell>{variation.type}</TableCell>
                                            <TableCell>${location.total_variation_cost?.toFixed(2)}</TableCell>
                                            <TableCell>${location.total_variation_revenue?.toFixed(2)}</TableCell>
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
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
};

export default LocationVariations;

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link } from '@inertiajs/react';
import { CirclePlus, Download, Trash } from 'lucide-react';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Variations',
        href: '/variations',
    },
];

const VariationIndex = ({ variations }) => {
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
                </div>
            </div>
            <div className="p-2">
                <Card className="4xl:max-w-4xl mx-auto mt-4 max-w-sm p-1 text-sm sm:max-w-full">
                    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl">
                        <Table>
                            <TableHeader className="rounded-t-xl hover:rounded-t-xl">
                                <TableRow>
                                    <TableHead>VAR #</TableHead>
                                    <TableHead className=""> Date</TableHead>
                                    <TableHead className="">Description</TableHead>
                                    <TableHead className="">Type</TableHead>
                                    <TableHead className="">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variations.map((variation) => (
                                    <TableRow key={variation.id}>
                                        <TableCell>
                                            <Badge>{variation.co_number}</Badge>
                                        </TableCell>
                                        <TableCell>{new Date(variation.co_date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell>{variation.description}</TableCell>
                                        <TableCell>{variation.type}</TableCell>
                                        <TableCell className="space-x-1">
                                            <a href={`/variations/${variation.id}/download/pdf`}>
                                                <Button title="Download as Excel" variant="outline">
                                                    <Download />
                                                </Button>
                                            </a>
                                            <a
                                                href={`/variations/${variation.id}`}
                                                onClick={() => confirm('Are you sure you want to delete this variation?')}
                                            >
                                                <Button title="Delete Variation" variant="outline">
                                                    <Trash />
                                                </Button>
                                            </a>
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

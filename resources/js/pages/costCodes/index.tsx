import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { CostCode } from '../purchasing/types';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cost Codes',
        href: '/cost-codes',
    },
];

export default function CostCodesIndex() {
    const { costcodes, flash } = usePage<{ costcodes: CostCode[]; flash: { success?: string } }>().props;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cost Codes" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Assuming you have a costCodes prop with the data */}
                        {/* Replace this with your actual data rendering logic */}
                        {costcodes.map((costCode) => (
                            <TableRow key={costCode.id}>
                                <TableCell>{costCode.code}</TableCell>
                                <TableCell>{costCode.description}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}

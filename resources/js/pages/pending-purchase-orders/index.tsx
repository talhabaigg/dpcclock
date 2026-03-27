import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { PendingPurchaseOrder, pendingPurchaseOrderColumns } from './columns';
import { DataTable } from './data-table';

interface Location {
    id: number;
    name: string;
    external_id: string | null;
}

interface Props {
    location: Location;
    pendingOrders: PendingPurchaseOrder[];
    asOfDate: string;
    stats: {
        total_amount: number;
        po_count: number;
        line_count: number;
    };
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PendingPurchaseOrdersIndex({ location, pendingOrders, asOfDate, stats }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}/dashboard` },
        { title: 'Pending Purchase Orders', href: `/locations/${location.id}/pending-purchase-orders` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Pending POs - ${location.name}`} />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h2 className="text-lg font-semibold">Pending Purchase Orders</h2>
                    <p className="text-muted-foreground text-sm">
                        {location.external_id ? `Job: ${location.external_id}` : 'No job number linked to this location'}
                        {' '}&mdash; As of {formatDate(asOfDate)}
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-muted-foreground text-sm font-medium">Total Pending Amount</div>
                            <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.total_amount)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-muted-foreground text-sm font-medium">Pending POs</div>
                            <div className="text-2xl font-bold">{stats.po_count}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-muted-foreground text-sm font-medium">Total Lines</div>
                            <div className="text-2xl font-bold">{stats.line_count}</div>
                        </CardContent>
                    </Card>
                </div>

                <DataTable columns={pendingPurchaseOrderColumns} data={pendingOrders} />
            </div>
        </AppLayout>
    );
}

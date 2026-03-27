import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PremierPoHeader, premierPoHeaderColumns } from './columns';
import { DataTable } from './data-table';

interface Location {
    id: number;
    name: string;
    external_id: string | null;
}

interface Props {
    location: Location;
    poHeaders: PremierPoHeader[];
    stats: {
        total: number;
        linked: number;
        orphaned: number;
    };
}

export default function PremierPoHeadersIndex({ location, poHeaders, stats }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    const [isSyncing, setIsSyncing] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}/dashboard` },
        { title: 'Premier PO Headers', href: `/locations/${location.id}/premier-po-headers` },
    ];

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
            setIsSyncing(false);
        }
        if (flash.error) {
            toast.error(flash.error);
            setIsSyncing(false);
        }
    }, [flash.success, flash.error]);

    const handleSync = () => {
        setIsSyncing(true);
        router.post(`/locations/${location.id}/premier-po-headers/sync`, {}, {
            onError: () => setIsSyncing(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Premier PO Headers - ${location.name}`} />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Premier PO Headers</h2>
                        <p className="text-muted-foreground text-sm">
                            {location.external_id ? `Job: ${location.external_id}` : 'No job number linked to this location'}
                        </p>
                    </div>
                    <Button onClick={handleSync} disabled={isSyncing || !location.external_id}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync POs from Premier'}
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-muted-foreground text-sm font-medium">Total POs</div>
                            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-muted-foreground text-sm font-medium">Linked to Requisition</div>
                            <div className="text-2xl font-bold text-green-600">{stats.linked.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-muted-foreground text-sm font-medium">Orphaned (No Requisition)</div>
                            <div className="text-2xl font-bold text-amber-600">{stats.orphaned.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                </div>

                <DataTable columns={premierPoHeaderColumns} data={poHeaders} />
            </div>
        </AppLayout>
    );
}

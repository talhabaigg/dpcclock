import SyncManager from '@/components/sync-manager';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Data Sync', href: '/data-sync' }];

export default function DataSyncIndex() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Data Sync" />
            <div className="mx-auto max-w-2xl space-y-6 p-4">
                <div>
                    <h1 className="text-lg font-semibold">Premier Data Sync</h1>
                    <p className="text-muted-foreground text-sm">
                        Select which data sources to sync from Premier. Incremental syncs only fetch new data since the last sync.
                    </p>
                </div>
                <SyncManager />
            </div>
        </AppLayout>
    );
}

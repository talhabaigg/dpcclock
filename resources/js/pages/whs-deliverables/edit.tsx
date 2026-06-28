import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { type DeliverableDetail, type DeliverableLocation, type TypesConfig } from './shared';
import WhsDeliverableForm from './whs-deliverable-form';

interface Props {
    location: DeliverableLocation;
    entry: DeliverableDetail;
    types: TypesConfig;
}

export default function WhsDeliverableEdit({ location, entry, types }: Props) {
    const baseUrl = `/locations/${location.id}/whs-deliverables`;
    const showUrl = `${baseUrl}/${entry.id}`;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'WHS Deliverables', href: '/whs-deliverables' },
        { title: location.name, href: baseUrl },
        { title: entry.name, href: showUrl },
        { title: 'Edit', href: `${showUrl}/edit` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${entry.name} — WHS Deliverables`} />
            <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">Edit deliverable</h1>
                    <p className="text-muted-foreground text-xs">{entry.name}</p>
                </div>
                <WhsDeliverableForm baseUrl={baseUrl} types={types} entry={entry} cancelUrl={showUrl} />
            </div>
        </AppLayout>
    );
}

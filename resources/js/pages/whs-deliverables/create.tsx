import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { type DeliverableLocation, type TypesConfig } from './shared';
import WhsDeliverableForm from './whs-deliverable-form';

interface Props {
    location: DeliverableLocation;
    types: TypesConfig;
}

export default function WhsDeliverableCreate({ location, types }: Props) {
    const baseUrl = `/locations/${location.id}/whs-deliverables`;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'WHS Deliverables', href: '/whs-deliverables' },
        { title: location.name, href: baseUrl },
        { title: 'New', href: `${baseUrl}/create` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`New deliverable — ${location.name}`} />
            <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
                <WhsDeliverableForm baseUrl={baseUrl} types={types} cancelUrl={baseUrl} />
            </div>
        </AppLayout>
    );
}

import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import Calendar from './main-partials/calendar';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Calendar',
        href: '/calendar',
    },
];

export default function CostCodesIndex() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cost Codes" />

            <Calendar />
        </AppLayout>
    );
}

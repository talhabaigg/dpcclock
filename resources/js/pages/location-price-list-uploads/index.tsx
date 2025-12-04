import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { locationPriceListUploadColumns } from './index-partials/columns';
import { DataTable } from './index-partials/data-table';

const LocationPriceListUpload = ({ location }) => {
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: `${location.name}`,
            href: `/locations/${location.id}`,
        },
        {
            title: 'Price List Uploads',
            href: `/location/${location.id}/material-item-price-list-uploads`,
        },
    ];
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Audit Price List Uploads" />
            <div className="sm:mx-2">
                <div className="mx-auto my-2 max-w-96 overflow-auto sm:max-w-full sm:min-w-full">
                    <DataTable columns={locationPriceListUploadColumns} data={location.material_item_price_list_uploads} />
                </div>
            </div>
        </AppLayout>
    );
};

export default LocationPriceListUpload;

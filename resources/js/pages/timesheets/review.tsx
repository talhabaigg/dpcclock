import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const ReviewTimesheets = ({ weekEnding }) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: `Timesheet Review - Week Ending ${weekEnding}`, href: '/timesheets' }];
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Timesheets" />
        </AppLayout>
    );
};

export default ReviewTimesheets;

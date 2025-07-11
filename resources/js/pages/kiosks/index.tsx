import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SelectFilter } from '../purchasing/index-partials/selectFilter';
import KioskCard from './index-partials/kiosk-card';

// Define the Kiosk type
interface Kiosk {
    id: number;
    name: string;
    eh_location_id: string;
    location?: {
        name?: string;
        eh_parent_id?: string | null;
    };
    default_start_time: string;
    default_end_time: string;
    employees?:
        | {
              name: string;
          }[]
        | undefined;
}
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Kiosks', href: '/kiosks' }];

export default function KiosksList() {
    const { kiosks, flash } = usePage<{ kiosks: Kiosk[]; flash?: { success?: string } }>().props;
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<string | null>(() => localStorage.getItem('companySelected') ?? null);
    const handleCompanyChange = (value: string) => {
        setFilter(value);
        localStorage.setItem('companySelected', value);
    };
    const filteredLocations = useMemo(() => {
        return filter ? kiosks.filter((kiosk) => kiosk.location.eh_parent_id === filter) : kiosks;
    }, [kiosks, filter]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kiosks" />
            <LoadingDialog open={open} setOpen={setOpen} />
            <div className="mx-auto mt-2 flex flex-col gap-2 sm:mx-2 sm:flex-row sm:items-center">
                <div className="flex min-w-96 flex-col gap-2 sm:flex-row">
                    <Link href="/kiosks/sync" method="get">
                        <Button variant="outline" className="w-full max-w-96 sm:w-32" onClick={() => setOpen(true)}>
                            <RefreshCcw /> Sync Kiosk
                        </Button>
                    </Link>
                    <Link href="/employees/kiosks/update" method="get">
                        <Button variant="outline" className="mx-auto w-full max-w-96" onClick={() => setOpen(true)}>
                            <RefreshCcw />
                            Sync Employees with Kiosk
                        </Button>
                    </Link>
                    <div className="w-full min-w-48 sm:max-w-48">
                        <SelectFilter
                            value={filter}
                            options={[
                                { value: '1149031', label: 'SWC' },
                                { value: '1249093', label: 'SWCP' },
                                { value: '1198645', label: 'Greenline' },
                            ]}
                            filterName={`Filter by Company`}
                            onChange={(val) => handleCompanyChange(val)}
                        />
                    </div>
                </div>

                <div className="mx-auto flex max-w-96 sm:mx-0 sm:max-w-full">
                    {flash?.success && <div className="text-green-500">{flash.success}</div>}
                </div>
            </div>
            <div className="mx-auto mb-2 grid max-w-96 grid-cols-1 gap-2 space-y-2 space-x-2 sm:m-2 sm:mx-0 sm:max-w-full sm:grid-cols-3 sm:p-2">
                {filteredLocations.map((kiosk) => (
                    <KioskCard kiosk={kiosk}></KioskCard>
                ))}
            </div>
        </AppLayout>
    );
}

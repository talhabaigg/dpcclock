import InputSearch from '@/components/inputSearch';
import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CheckCircle2, Monitor, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SelectFilter } from '../purchasing/index-partials/selectFilter';
import KioskCard from './index-partials/kiosk-card';

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

const companyOptions = [
    { value: '1149031', label: 'SWC' },
    { value: '1249093', label: 'SWCP' },
    { value: '1198645', label: 'Greenline' },
];

export default function KiosksList() {
    const { kiosks, flash } = usePage<{ kiosks: Kiosk[]; flash?: { success?: string } }>().props;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<string | null>(() => localStorage.getItem('companySelected') ?? null);

    const handleCompanyChange = (value: string) => {
        setFilter(value);
        localStorage.setItem('companySelected', value);
    };

    const filteredKiosks = useMemo(() => {
        let result = filter ? kiosks.filter((kiosk) => kiosk.location?.eh_parent_id === filter) : kiosks;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (kiosk) =>
                    kiosk.name.toLowerCase().includes(query) ||
                    kiosk.location?.name?.toLowerCase().includes(query) ||
                    kiosk.eh_location_id.toLowerCase().includes(query),
            );
        }

        return result;
    }, [kiosks, filter, searchQuery]);

    const selectedCompanyLabel = companyOptions.find((opt) => opt.value === filter)?.label;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kiosks" />
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            <Monitor className="text-primary h-6 w-6" />
                            Kiosks
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Manage time clock kiosks and employee assignments
                            {selectedCompanyLabel && (
                                <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                                    {selectedCompanyLabel}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/kiosks/sync" method="get">
                            <Button variant="outline" className="hover:border-primary/50 gap-2 transition-all" onClick={() => setOpen(true)}>
                                <RefreshCcw className="h-4 w-4" />
                                Sync Kiosks
                            </Button>
                        </Link>
                        <Link href="/employees/kiosks/update" method="get">
                            <Button variant="outline" className="hover:border-primary/50 gap-2 transition-all" onClick={() => setOpen(true)}>
                                <RefreshCcw className="h-4 w-4" />
                                Sync Employees
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Flash Message */}
                {flash?.success && (
                    <Alert className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertTitle className="text-emerald-700 dark:text-emerald-400">Success</AlertTitle>
                        <AlertDescription className="text-emerald-600 dark:text-emerald-300">{flash.success}</AlertDescription>
                    </Alert>
                )}

                {/* Filters Bar */}
                <div className="bg-muted/30 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Monitor className="h-4 w-4" />
                        <span>
                            {filteredKiosks.length} kiosk{filteredKiosks.length !== 1 ? 's' : ''} found
                        </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-64">
                            <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="kiosk or location" />
                        </div>
                        <div className="w-full sm:w-44">
                            <SelectFilter value={filter} options={companyOptions} filterName="All Companies" onChange={handleCompanyChange} />
                        </div>
                    </div>
                </div>

                {/* Kiosks Grid */}
                {filteredKiosks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                        <Monitor className="text-muted-foreground/40 h-12 w-12" />
                        <h3 className="mt-4 text-lg font-medium">No kiosks found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {searchQuery || filter ? 'Try adjusting your search or filter' : 'Sync kiosks to get started'}
                        </p>
                        {(searchQuery || filter) && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => {
                                    setSearchQuery('');
                                    setFilter(null);
                                    localStorage.removeItem('companySelected');
                                }}
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredKiosks.map((kiosk) => (
                            <KioskCard key={kiosk.id} kiosk={kiosk} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

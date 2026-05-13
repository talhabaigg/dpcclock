import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Menu } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import CostCodeRatiosGrid, { type RatioRow } from './partials.tsx/costCodeRatiosGrid';
import RatioUploader from './partials.tsx/ratioUploader';

type CostCodeFormRow = {
    id: number;
    variation_ratio: number;
    dayworks_ratio: number;
    waste_ratio: number;
    prelim_type: string;
};

interface CostCode {
    id: number;
    code: string;
    description: string;
    cost_type?: { code: string } | null;
    pivot: {
        variation_ratio?: number;
        dayworks_ratio?: number;
        waste_ratio?: number;
        prelim_type?: string;
    };
}

export default function CostCodeEdit({
    location,
    costCodes,
    flash,
}: {
    location: { id: number; name: string };
    costCodes: CostCode[];
    flash: { success?: string };
}) {
    const [importerOpen, setImporterOpen] = useState(false);

    const { data, setData, put, processing, errors } = useForm<{
        locationId: number;
        costCodes: CostCodeFormRow[];
    }>({
        locationId: location.id,
        costCodes: costCodes.map((code) => ({
            id: code.id,
            variation_ratio: code.pivot.variation_ratio ?? 0,
            dayworks_ratio: code.pivot.dayworks_ratio ?? 0,
            waste_ratio: code.pivot.waste_ratio ?? 0,
            prelim_type: code.pivot.prelim_type ?? '',
        })),
    });

    const dataRef = useRef(data);
    dataRef.current = data;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Edit Ratios', href: `/locations/${location.id}/cost-codes/edit` },
    ];

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
    }, [flash.success]);

    useEffect(() => {
        if (Object.keys(errors).length > 0) {
            toast.error('There were errors with your submission');
        }
    }, [errors]);

    const initialRows = useMemo<RatioRow[]>(
        () =>
            costCodes.map((code) => ({
                id: code.id,
                code: code.code,
                description: code.description,
                cost_type: code.cost_type?.code ?? '',
                variation_ratio: code.pivot.variation_ratio ?? 0,
                dayworks_ratio: code.pivot.dayworks_ratio ?? 0,
                waste_ratio: code.pivot.waste_ratio ?? 0,
                prelim_type: code.pivot.prelim_type ? code.pivot.prelim_type : 'NONE',
            })),
        [costCodes],
    );

    const handleRowChange = (id: number, patch: Partial<RatioRow>) => {
        const normalized: Partial<CostCodeFormRow> = {};
        if ('variation_ratio' in patch) normalized.variation_ratio = Number(patch.variation_ratio) || 0;
        if ('dayworks_ratio' in patch) normalized.dayworks_ratio = Number(patch.dayworks_ratio) || 0;
        if ('waste_ratio' in patch) normalized.waste_ratio = Number(patch.waste_ratio) || 0;
        if ('prelim_type' in patch) normalized.prelim_type = patch.prelim_type === 'NONE' ? '' : (patch.prelim_type ?? '');

        setData(
            'costCodes',
            dataRef.current.costCodes.map((c) => (c.id === id ? { ...c, ...normalized } : c)),
        );
    };

    const handleSave = () => {
        put(`/location/${location.id}/cost-codes/update`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Ratios - ${location.name}`} />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-2 sm:gap-4 sm:p-4 md:p-6">
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" size="sm" disabled={processing} onClick={handleSave}>
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" aria-label="More actions">
                                <Menu className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-max">
                            <DropdownMenuItem className="whitespace-nowrap" onClick={() => setImporterOpen(true)}>
                                Import Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem className="whitespace-nowrap" asChild>
                                <a href={`/location/${location.id}/cost-code-ratios/download-csv`}>Download Excel</a>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {costCodes.length === 0 ? (
                    <div className="text-muted-foreground rounded-md border py-12 text-center text-sm">
                        No cost codes found. Sync from Premier first.
                    </div>
                ) : (
                    <CostCodeRatiosGrid rows={initialRows} onRowChange={handleRowChange} />
                )}
            </div>

            <RatioUploader locationId={location.id} open={importerOpen} onOpenChange={setImporterOpen} />
        </AppLayout>
    );
}

// ✅ Imports
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card'; // (Assumes CardAction is custom; see note below)
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // <-- use shadcn
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { CheckCircle } from 'lucide-react';
import RatioUploader from './partials.tsx/ratioUploader'; // <-- fixed path

// Types for form state
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

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Edit Ratios', href: `/locations/${location.id}/cost-codes/edit` },
    ];

    // ✅ Numeric ratio updates (typed keys)
    const handleRatioChange = (id: number, value: string, key: 'variation_ratio' | 'dayworks_ratio' | 'waste_ratio') => {
        const num = Number.parseFloat(value);
        const sanitized = Number.isFinite(num) ? num : 0;
        setData(
            'costCodes',
            data.costCodes.map((c) => (c.id === id ? { ...c, [key]: sanitized } : c)),
        );
    };

    // ✅ Prelim type updates (string)
    const handlePrelimTypeChange = (id: number, value: string) => {
        setData(
            'costCodes',
            data.costCodes.map((c) => (c.id === id ? { ...c, prelim_type: value } : c)),
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/location/${location.id}/cost-codes/update`); // <-- plural for consistency
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-2">
                <div className="flex flex-col justify-end gap-2 sm:m-2 sm:flex-row">
                    <RatioUploader locationId={location.id} />
                    <Button
                        className="w-32"
                        type="button"
                        onClick={() => window.open(`/location/${location.id}/cost-code-ratios/download-csv`, '_blank')}
                    >
                        Download CSV
                    </Button>
                </div>

                <form onSubmit={handleSubmit}>
                    <Card>
                        {flash.success && (
                            <Alert className="mx-2 max-w-96 sm:max-w-[50%]">
                                {' '}
                                {/* <-- fixed */}
                                <CheckCircle />
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>{flash.success}</AlertDescription>
                            </Alert>
                        )}

                        {Object.keys(errors).length > 0 && (
                            <Alert variant="destructive" className="mx-2 max-w-96 sm:max-w-[50%]">
                                {' '}
                                {/* <-- fixed */}
                                <AlertTitle>There were some errors with your submission:</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-4">
                                        {Object.entries(errors).map(([field, message]) => (
                                            <li key={field}>{message as string}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        <CardHeader className="flex items-center justify-between">
                            <div>Edit Ratios for Cost Codes {location.name}</div>
                        </CardHeader>

                        <CardContent>
                            <div className="flex justify-between">
                                <Label>Cost Item</Label>
                                <div className="flex space-x-2">
                                    <Label className="min-w-32 p-1">Variation Ratio</Label>
                                    <Label className="min-w-32 p-1">Dayworks Ratio</Label>
                                    <Label className="min-w-32 p-1">Waste Ratio</Label>
                                    <Label className="min-w-32 p-1">Prelim Type</Label>
                                </div>
                            </div>

                            {data.costCodes.length > 0 &&
                                costCodes.map((code) => {
                                    const row = data.costCodes.find((c) => c.id === code.id);
                                    return (
                                        <div key={code.id}>
                                            <div className="flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge>{code.code}</Badge>
                                                    <span>{code.description}</span>
                                                </div>

                                                <div className="flex flex-row space-x-2">
                                                    {/* Variation */}
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-500">
                                                            %
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            step="any"
                                                            value={row?.variation_ratio ?? 0}
                                                            onChange={(e) => handleRatioChange(code.id, e.target.value, 'variation_ratio')}
                                                            className="w-32 pl-6"
                                                        />
                                                    </div>

                                                    {/* Dayworks */}
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-500">
                                                            %
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            step="any"
                                                            value={row?.dayworks_ratio ?? 0}
                                                            onChange={(e) => handleRatioChange(code.id, e.target.value, 'dayworks_ratio')}
                                                            className="w-32 pl-6"
                                                        />
                                                    </div>

                                                    {/* Waste */}
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-500">
                                                            %
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            step="any"
                                                            value={row?.waste_ratio ?? 0}
                                                            onChange={(e) => handleRatioChange(code.id, e.target.value, 'waste_ratio')}
                                                            className="w-32 pl-6"
                                                        />
                                                    </div>

                                                    {/* Prelim Type */}
                                                    <Select
                                                        onValueChange={(val) => handlePrelimTypeChange(code.id, val)}
                                                        value={row?.prelim_type ?? ''}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue placeholder="Select Prelim Type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="MAT">MAT</SelectItem>
                                                            <SelectItem value="LAB">LAB</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <Separator className="my-2" />
                                        </div>
                                    );
                                })}

                            {/* If CardAction is a custom abstraction, keep it. If you're on stock shadcn, use CardFooter instead. */}
                            <div className="flex justify-end">
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </AppLayout>
    );
}

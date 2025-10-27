import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { CheckCircle } from 'lucide-react';
import RatioUploader from './partials.tsx/ratioUploader';

interface CostCode {
    id: number;
    code: string;
    description: string;
    pivot: {
        variation_ratio?: number;
        dayworks_ratio?: number;
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
    const { data, setData, put, processing, errors } = useForm({
        locationId: location.id,
        costCodes: costCodes.map((code) => ({
            id: code.id,
            variation_ratio: code.pivot.variation_ratio ?? 0,
            dayworks_ratio: code.pivot.dayworks_ratio ?? 0,
        })),
    });
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: location.name,
            href: `/locations/${location.id}`,
        },
        {
            title: 'Edit Ratios',
            href: `/locations/${location.id}/cost-codes/edit`,
        },
    ];

    const handleRatioChange = (id: number, value: string, type: 'variation' | 'dayworks') => {
        const updatedCostCodes = data.costCodes.map((code) => (code.id === id ? { ...code, [`${type}_ratio`]: parseFloat(value) || 0 } : code));
        setData('costCodes', updatedCostCodes);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting data:', data);
        put(`/location/${location.id}/cost-codes/update`);
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
                            <Alert className="mx-2 max-w-96 sm:max-w-1/2">
                                <CheckCircle />
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>
                                    {flash.success}
                                    <br />
                                </AlertDescription>
                            </Alert>
                        )}
                        {Object.keys(errors).length > 0 && (
                            <Alert variant="destructive" className="mx-2 max-w-96 sm:max-w-1/2">
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
                            <span> </span>
                            <div className="flex justify-between">
                                <Label>Cost Item</Label>
                                <div className="flex space-x-2">
                                    {' '}
                                    <Label className="min-w-32 p-1">Variation Ratio</Label>
                                    <Label className="min-w-32 p-1">Dayworks Ratio</Label>
                                </div>
                            </div>
                            {data.costCodes.length > 0 &&
                                costCodes.map((code) => {
                                    const ratioEntry = data.costCodes.find((c) => c.id === code.id);
                                    return (
                                        <div key={code.id}>
                                            <div className="flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge>{code.code}</Badge>
                                                    <span>{code.description}</span>
                                                </div>

                                                <div className="relative flex flex-row space-x-2">
                                                    <div className="relative flex flex-row space-x-2">
                                                        {/* First input */}

                                                        <div className="relative">
                                                            <span className="absolute top-1/2 left-2 -translate-y-1/2 text-gray-500">%</span>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={ratioEntry?.variation_ratio ?? ''}
                                                                onChange={(e) => handleRatioChange(code.id, e.target.value, 'variation')}
                                                                className="w-32 pl-6"
                                                            />
                                                        </div>

                                                        {/* Second input */}
                                                        <div className="relative">
                                                            <span className="absolute top-1/2 left-2 -translate-y-1/2 text-gray-500">%</span>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={ratioEntry?.dayworks_ratio ?? ''}
                                                                onChange={(e) => handleRatioChange(code.id, e.target.value, 'dayworks')}
                                                                className="w-32 pl-6"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <Separator className="my-2" />
                                        </div>
                                    );
                                })}

                            <CardAction className="flex justify-end">
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </CardAction>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </AppLayout>
    );
}

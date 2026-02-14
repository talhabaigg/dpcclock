import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Download } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
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

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
    }, [flash.success]);

    useEffect(() => {
        if (Object.keys(errors).length > 0) {
            toast.error('There were errors with your submission');
        }
    }, [errors]);

    const handleRatioChange = (id: number, value: string, key: 'variation_ratio' | 'dayworks_ratio' | 'waste_ratio') => {
        const num = Number.parseFloat(value);
        const sanitized = Number.isFinite(num) ? num : 0;
        setData(
            'costCodes',
            data.costCodes.map((c) => (c.id === id ? { ...c, [key]: sanitized } : c)),
        );
    };

    const handlePrelimTypeChange = (id: number, value: string) => {
        setData(
            'costCodes',
            data.costCodes.map((c) => (c.id === id ? { ...c, prelim_type: value } : c)),
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/location/${location.id}/cost-codes/update`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Ratios - ${location.name}`} />

            <div className="flex flex-col gap-4 p-2 sm:gap-6 sm:p-4 md:p-6">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <Link href={`/locations/${location.id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex-1" />
                    <RatioUploader locationId={location.id} />
                    <a href={`/location/${location.id}/cost-code-ratios/download-csv`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Download Excel</span>
                        </Button>
                    </a>
                </div>

                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Cost Code Ratios</CardTitle>
                                <Button type="submit" size="sm" disabled={processing}>
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {costCodes.length === 0 ? (
                                <div className="text-muted-foreground py-12 text-center text-sm">
                                    No cost codes found. Sync from Premier first.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-3 sm:pl-6">Code</TableHead>
                                                <TableHead className="hidden sm:table-cell">Description</TableHead>
                                                <TableHead className="text-right">Variation %</TableHead>
                                                <TableHead className="text-right">Dayworks %</TableHead>
                                                <TableHead className="hidden text-right md:table-cell">Waste %</TableHead>
                                                <TableHead className="pr-3 sm:pr-6">Type</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {costCodes.map((code) => {
                                                const row = data.costCodes.find((c) => c.id === code.id);
                                                return (
                                                    <TableRow key={code.id}>
                                                        <TableCell className="pl-3 sm:pl-6">
                                                            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                                {code.code}
                                                            </code>
                                                            <p className="text-muted-foreground mt-0.5 text-xs sm:hidden">
                                                                {code.description}
                                                            </p>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground hidden max-w-xs truncate sm:table-cell">
                                                            {code.description}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={row?.variation_ratio ?? 0}
                                                                onChange={(e) => handleRatioChange(code.id, e.target.value, 'variation_ratio')}
                                                                className="ml-auto h-8 w-20 text-right sm:w-24"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={row?.dayworks_ratio ?? 0}
                                                                onChange={(e) => handleRatioChange(code.id, e.target.value, 'dayworks_ratio')}
                                                                className="ml-auto h-8 w-20 text-right sm:w-24"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="hidden text-right md:table-cell">
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={row?.waste_ratio ?? 0}
                                                                onChange={(e) => handleRatioChange(code.id, e.target.value, 'waste_ratio')}
                                                                className="ml-auto h-8 w-20 text-right sm:w-24"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="pr-3 sm:pr-6">
                                                            <Select
                                                                onValueChange={(val) => handlePrelimTypeChange(code.id, val)}
                                                                value={row?.prelim_type ?? ''}
                                                            >
                                                                <SelectTrigger className="h-8 w-20 sm:w-24">
                                                                    <SelectValue placeholder="-" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="MAT">MAT</SelectItem>
                                                                    <SelectItem value="LAB">LAB</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </form>
            </div>
        </AppLayout>
    );
}

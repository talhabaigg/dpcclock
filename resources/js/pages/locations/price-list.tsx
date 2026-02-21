import CsvImporterDialog from '@/components/csv-importer';
import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { cn } from '@/lib/utils';
import { router, usePage } from '@inertiajs/react';
import { Download, FileSpreadsheet, Lock, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AttachMaterialsDialog from './partials.tsx/AttachMaterialsDialog';
import EditPriceDialog from './partials.tsx/EditPriceDialog';
import LocationPriceHistoryDialog from './partials.tsx/LocationPriceHistoryDialog';
import PriceHistoryDialog from './partials.tsx/PriceHistoryDialog';
import RemoveMaterialDialog from './partials.tsx/RemoveMaterialDialog';

type Location = LocationBase & {
    material_items: Array<{
        id: number;
        code: string;
        description: string;
        supplier?: {
            id: number;
            code: string;
        };
        pivot?: {
            unit_cost_override: number;
            is_locked: boolean;
            updated_by: number | null;
            updated_by_name: string | null;
            updated_at: string | null;
        };
    }>;
};

export default function LocationPriceList() {
    const { location } = usePage<{ location: Location }>().props;

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [csvImportHeaders] = useState<string[]>(['location_id', 'code', 'unit_cost', 'is_locked']);
    const [showLockedOnly, setShowLockedOnly] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);

    const handleUpload = (locationId: number) => {
        if (!selectedFile) {
            toast.error('No file selected for upload');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('location_id', locationId.toString());

        setIsUploading(true);
        router.post('/material-items/location/upload', formData, {
            forceFormData: true,
            onSuccess: () => {
                setSelectedFile(null);
                setIsUploading(false);
            },
            onError: () => {
                setIsUploading(false);
            },
            onFinish: () => {
                setIsUploading(false);
            },
        });
    };

    const handleCsvSubmit = (mappedData: any) => {
        const csvContent = `${csvImportHeaders.join(',')}\n${mappedData
            .map((row: any) => csvImportHeaders.map((header) => row[header] ?? '').join(','))
            .join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });
        setSelectedFile(file);
        setShouldUploadAfterSet(true);
    };

    useEffect(() => {
        if (selectedFile && shouldUploadAfterSet) {
            handleUpload(location.id);
            setShouldUploadAfterSet(false);
        }
    }, [selectedFile, shouldUploadAfterSet]);

    const filteredMaterialItems = showLockedOnly
        ? (location.material_items?.filter((item) => Boolean(item.pivot?.is_locked)) ?? [])
        : (location.material_items ?? []);

    return (
        <LocationLayout location={location} activeTab="price-list">
            <LoadingDialog open={isUploading} setOpen={() => {}} message="Uploading price list..." />
            <Card>
                <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base">Price List</CardTitle>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <div className="mr-1 flex items-center gap-2 sm:mr-2">
                                <Switch id="show-locked" checked={showLockedOnly} onCheckedChange={setShowLockedOnly} />
                                <Label htmlFor="show-locked" className="flex cursor-pointer items-center gap-1 text-sm">
                                    <Lock className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Locked Only</span>
                                </Label>
                            </div>
                            <AttachMaterialsDialog
                                locationId={location.id}
                                existingMaterialIds={location.material_items?.map((m) => m.id) ?? []}
                            />
                            <LocationPriceHistoryDialog locationId={location.id} locationName={location.name} />
                            <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                            <a href={`/material-items/location/${location.id}/download-csv`}>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <span className="hidden sm:inline">CSV</span>
                                </Button>
                            </a>
                            <a href={`/material-items/location/${location.id}/download-excel`}>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Excel</span>
                                </Button>
                            </a>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">Code</TableHead>
                                    <TableHead className="hidden lg:table-cell">Supplier</TableHead>
                                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    <TableHead className="hidden md:table-cell">Updated By</TableHead>
                                    <TableHead className="w-20 pr-3 sm:w-28 sm:pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMaterialItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                <Package className="h-8 w-8 opacity-40" />
                                                <p>{showLockedOnly ? 'No locked items' : 'No price list available'}</p>
                                                <p className="text-xs">
                                                    {showLockedOnly ? 'No items are currently locked' : 'Import a CSV to add items'}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMaterialItems.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className={cn(
                                                'group',
                                                item.pivot?.is_locked && 'bg-amber-50/50 dark:bg-amber-950/20',
                                            )}
                                        >
                                            <TableCell className="pl-3 sm:pl-6">
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                        {item.code}
                                                    </code>
                                                    {item.pivot?.is_locked ? (
                                                        <TooltipProvider delayDuration={200}>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Price is locked</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                {item.supplier?.code ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        {item.supplier.code}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm italic">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground hidden max-w-md truncate sm:table-cell">{item.description}</TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                    $
                                                    {(() => {
                                                        const num = Number(item.pivot?.unit_cost_override ?? 0);
                                                        const formatted = num.toFixed(6).replace(/\.?0+$/, '');
                                                        const decimals = formatted.includes('.') ? formatted.split('.')[1].length : 0;
                                                        return decimals < 2 ? num.toFixed(2) : formatted;
                                                    })()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {item.pivot?.updated_by_name ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{item.pivot.updated_by_name}</span>
                                                        {item.pivot?.updated_at && (
                                                            <span className="text-muted-foreground text-xs">
                                                                {new Date(item.pivot.updated_at).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm italic">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="pr-3 sm:pr-6">
                                                <div className="flex items-center gap-1">
                                                    {!item.pivot?.is_locked && (
                                                        <EditPriceDialog
                                                            locationId={location.id}
                                                            materialItemId={item.id}
                                                            code={item.code}
                                                            description={item.description}
                                                            currentPrice={Number(item.pivot?.unit_cost_override ?? 0)}
                                                            isLocked={item.pivot?.is_locked ?? false}
                                                        />
                                                    )}
                                                    <PriceHistoryDialog
                                                        locationId={location.id}
                                                        materialItemId={item.id}
                                                        code={item.code}
                                                        description={item.description}
                                                    />
                                                    {!item.pivot?.is_locked && (
                                                        <RemoveMaterialDialog
                                                            locationId={location.id}
                                                            materialItemId={item.id}
                                                            code={item.code}
                                                            description={item.description}
                                                        />
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </LocationLayout>
    );
}

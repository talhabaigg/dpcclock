import CsvImporterDialog from '@/components/csv-importer';
import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ChartColumnIncreasing,
    CirclePlus,
    Code2,
    DollarSign,
    Download,
    Edit,
    ExternalLink,
    FileImage,
    FileSpreadsheet,
    FolderTree,
    Hash,
    Heart,
    Layers,
    Lock,
    Package,
    RefreshCcw,
    RotateCcw,
    Star,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AttachMaterialsDialog from './partials.tsx/AttachMaterialsDialog';
import EditPriceDialog from './partials.tsx/EditPriceDialog';
import FavouriteMaterialUploader from './partials.tsx/favMaterialUploader';
import LocationPriceHistoryDialog from './partials.tsx/LocationPriceHistoryDialog';
import PriceHistoryDialog from './partials.tsx/PriceHistoryDialog';
import RemoveMaterialDialog from './partials.tsx/RemoveMaterialDialog';

type Location = {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
    external_id: string;
    subLocations: Array<{
        id: number;
        name: string;
        eh_location_id: string;
        external_id: string;
    }>;
    worktypes: Array<{
        id: number;
        name: string;
        eh_worktype_id: string;
    }>;
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
    cost_codes: Array<{
        id: number;
        code: string;
        description: string;
    }>;
    favourite_materials: Array<{
        id: number;
        code: string;
        description: string;
    }>;
};

export default function LocationShow() {
    const { location, flash } = usePage<{
        location: Location;
        flash: { success?: string };
    }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: location.name,
            href: `/locations/${location.id}`,
        },
    ];

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [csvImportHeaders] = useState<string[]>(['location_id', 'code', 'unit_cost', 'is_locked']);
    const [activeTab, setActiveTab] = useState('sublocations');
    const [showLockedOnly, setShowLockedOnly] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [open, setOpen] = useState(false);

    const splitExternalId = (externalId: string) => {
        if (!externalId) {
            return { level: 'Not Set', activity: 'Not Set' };
        }
        const trimmedId = externalId.split('::').pop() || '';
        const parts = trimmedId.split('-');
        const level = parts[0] ? parts[0] : 'Not Set';
        const activity = parts[1] ? parts[1] : 'Not Set';
        return { level, activity };
    };

    const formData = useForm<{
        level: string | null;
        activity: string | null;
        location_id: number;
    }>({
        level: null,
        activity: null,
        location_id: location.id,
    });

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

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        router.post('/sub-locations', formData.data, {
            onSuccess: () => {
                formData.reset();
                toast.success('Sub-location created successfully');
            },
            onError: () => {
                toast.error('Error creating sub-location');
            },
        });

        formData.reset();
        setOpenDialog(false);
    };

    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);

    const handleCsvSubmit = (mappedData: any) => {
        // Explicitly use header order to ensure CSV columns match expected order
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

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);

    const filteredMaterialItems = showLockedOnly
        ? (location.material_items?.filter((item) => Boolean(item.pivot?.is_locked)) ?? [])
        : (location.material_items ?? []);

    const tabCounts = {
        sublocations: location.subLocations?.length || 0,
        costCodes: location.cost_codes?.length || 0,
        pricelist: location.material_items?.length || 0,
        fav_materials: location.favourite_materials?.length || 0,
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Location`} />
            <LoadingDialog open={open || isUploading} setOpen={setOpen} message={isUploading ? 'Uploading price list...' : 'Loading...'} />

            <div className="flex flex-col gap-4 p-2 sm:gap-6 sm:p-4 md:p-6">
                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Link href={`/location/${location.id}/job-data`} method="get">
                            <Button variant="outline" size="sm" className="gap-2">
                                <RotateCcw className="h-4 w-4" />
                                <span className="hidden sm:inline">Load Job Cost</span>
                            </Button>
                        </Link>
                        <Link href={`/location/${location.id}/job-forecast`} method="get">
                            <Button size="sm" className="gap-2">
                                <ChartColumnIncreasing className="h-4 w-4" />
                                <span className="hidden sm:inline">Job Forecast</span>
                            </Button>
                        </Link>
                        <Link href={`/projects/${location.id}/drawings`}>
                            <Button variant="outline" size="sm" className="gap-2">
                                <FileImage className="h-4 w-4" />
                                <span className="hidden sm:inline">Drawings</span>
                            </Button>
                        </Link>
                        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" size="sm" className="gap-2">
                                    <CirclePlus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Create Sub-location</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Create Sub-location</DialogTitle>
                                    <DialogDescription>
                                        Create a new sub-location for <span className="font-medium">{location.name}</span>. This will be synced to
                                        Employment Hero.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleFormSubmit}>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="level">Level</Label>
                                            <Input
                                                id="level"
                                                placeholder="Enter level code"
                                                value={formData.data.level ?? ''}
                                                onChange={(e) => formData.setData('level', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="activity">Activity</Label>
                                            <Input
                                                id="activity"
                                                placeholder="Enter activity code"
                                                value={formData.data.activity ?? ''}
                                                onChange={(e) => formData.setData('activity', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit">Create Sub-location</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                </div>

                {/* Overview Section */}
                <div className="grid gap-6">
                    {/* Location Details Card */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base">Location Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <Hash className="h-4 w-4" />
                                        Location ID
                                    </div>
                                    <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{location.eh_location_id}</code>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <ExternalLink className="h-4 w-4" />
                                        External ID
                                    </div>
                                    {location.external_id ? (
                                        <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{location.external_id}</code>
                                    ) : (
                                        <span className="text-muted-foreground text-sm italic">Not set</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <Layers className="h-4 w-4" />
                                        Parent ID
                                    </div>
                                    <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{location.eh_parent_id}</code>
                                </div>
                                <div className="px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                                        <Star className="h-4 w-4" />
                                        Shift Conditions
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {location.worktypes?.length > 0 ? (
                                            <>
                                                {location.worktypes.slice(0, 3).map((worktype) => (
                                                    <Badge key={worktype.eh_worktype_id} variant="secondary" className="text-xs">
                                                        {worktype.name}
                                                    </Badge>
                                                ))}
                                                {location.worktypes.length > 3 && (
                                                    <TooltipProvider delayDuration={200}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="outline" className="text-muted-foreground cursor-pointer text-xs">
                                                                    +{location.worktypes.length - 3} more
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom" className="max-w-xs p-3">
                                                                <p className="mb-2 text-xs font-medium">All Shift Conditions</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {location.worktypes.map((worktype) => (
                                                                        <Badge key={worktype.eh_worktype_id} variant="secondary" className="text-xs">
                                                                            {worktype.name}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground text-sm italic">No shift conditions configured</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs Section */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="h-auto w-full justify-start">
                        <TabsTrigger value="sublocations" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
                            <FolderTree className="h-4 w-4" />
                            <span className="hidden sm:inline">Sub-locations</span>
                            <span className="text-muted-foreground text-xs tabular-nums">
                                {tabCounts.sublocations}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="costCodes" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
                            <Code2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Cost Codes</span>
                            <span className="text-muted-foreground text-xs tabular-nums">{tabCounts.costCodes}</span>
                        </TabsTrigger>
                        <TabsTrigger value="pricelist" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
                            <DollarSign className="h-4 w-4" />
                            <span className="hidden sm:inline">Price List</span>
                            <span className="text-muted-foreground text-xs tabular-nums">{tabCounts.pricelist}</span>
                        </TabsTrigger>
                        <TabsTrigger value="fav_materials" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
                            <Heart className="h-4 w-4" />
                            <span className="hidden sm:inline">Favorites</span>
                            <span className="text-muted-foreground text-xs tabular-nums">
                                {tabCounts.fav_materials}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Sub-locations Tab */}
                    <TabsContent value="sublocations" className="mt-4">
                        <Card>
                            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                                <CardTitle className="text-base">Sub-locations</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-3 sm:pl-6">ID</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="hidden md:table-cell">External ID</TableHead>
                                                <TableHead className="hidden sm:table-cell">Level</TableHead>
                                                <TableHead className="hidden sm:table-cell pr-3 sm:pr-6">Activity</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {location.subLocations.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-32 text-center">
                                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                            <FolderTree className="h-8 w-8 opacity-40" />
                                                            <p>No sub-locations found</p>
                                                            <Button variant="outline" size="sm" onClick={() => setOpenDialog(true)}>
                                                                <CirclePlus className="mr-2 h-4 w-4" />
                                                                Create Sub-location
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                location.subLocations.map((subLocation) => (
                                                    <TableRow key={subLocation.id}>
                                                        <TableCell className="text-muted-foreground pl-3 font-mono text-xs sm:pl-6">
                                                            {subLocation.eh_location_id}
                                                        </TableCell>
                                                        <TableCell className="font-medium">{subLocation.name}</TableCell>
                                                        <TableCell className="hidden md:table-cell">
                                                            {subLocation.external_id ? (
                                                                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                                                                    {subLocation.external_id}
                                                                </code>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm italic">Not set</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="hidden sm:table-cell">
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                {splitExternalId(subLocation.external_id).level}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="hidden pr-3 sm:table-cell sm:pr-6">
                                                            <Badge variant="secondary" className="font-mono text-xs">
                                                                {splitExternalId(subLocation.external_id).activity}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Cost Codes Tab */}
                    <TabsContent value="costCodes" className="mt-4">
                        <Card>
                            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <CardTitle className="text-base">Cost Codes</CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <Link href={`/location/${location.id}/cost-codes/sync`} method="get">
                                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                                <RefreshCcw className="h-4 w-4" />
                                                <span className="hidden sm:inline">Sync from Premier</span>
                                            </Button>
                                        </Link>
                                        <Link href={`/location/${location.id}/cost-codes/edit`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Edit className="h-4 w-4" />
                                                <span className="hidden sm:inline">Edit Ratios</span>
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-3 sm:pl-6">Code</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="w-20 pr-3 text-right sm:pr-6">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {location.cost_codes.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="h-32 text-center">
                                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                            <Code2 className="h-8 w-8 opacity-40" />
                                                            <p>No cost codes available</p>
                                                            <Link href={`/location/${location.id}/cost-codes/sync`} method="get">
                                                                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                                                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                                                    Sync from Premier
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                location.cost_codes.map((costCode) => (
                                                    <TableRow key={costCode.id} className="group">
                                                        <TableCell className="pl-3 sm:pl-6">
                                                            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                                {costCode.code}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{costCode.description}</TableCell>
                                                        <TableCell className="pr-3 text-right sm:pr-6">
                                                            <Link href={`/locations/${location.id}/cost-codes/${costCode.id}/delete`}>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-0 transition-all group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Price List Tab */}
                    <TabsContent value="pricelist" className="mt-4">
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
                    </TabsContent>

                    {/* Favorite Materials Tab */}
                    <TabsContent value="fav_materials" className="mt-4">
                        <Card>
                            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <CardTitle className="text-base">Favorite Materials</CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <FavouriteMaterialUploader locationId={location.id} />
                                        <a href={`/location/${location.id}/favourite-materials/download-csv`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Download className="h-4 w-4" />
                                                <span className="hidden sm:inline">Download CSV</span>
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
                                                <TableHead className="pr-3 sm:pr-6">Description</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!location.favourite_materials || location.favourite_materials.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={2} className="h-32 text-center">
                                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                            <Heart className="h-8 w-8 opacity-40" />
                                                            <p>No favorite materials</p>
                                                            <p className="text-xs">Import a CSV to add favorites</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                location.favourite_materials.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="pl-3 sm:pl-6">
                                                            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                                                                {item.code}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground pr-3 sm:pr-6">{item.description}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

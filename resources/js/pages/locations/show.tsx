import CsvImporterDialog from '@/components/csv-importer';
import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Building2,
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
    MapPin,
    Package,
    RefreshCcw,
    RotateCcw,
    Star,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChartLineLabel } from './monthlySpendingChart';
import FavouriteMaterialUploader from './partials.tsx/favMaterialUploader';

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

interface MonthlySpend {
    month: string;
    total: number;
}

export default function LocationShow() {
    const { location, flash, monthlySpending } = usePage<{
        location: Location;
        flash: { success?: string };
        monthlySpending: MonthlySpend[];
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
    const [csvImportHeaders] = useState<string[]>(['location_id', 'code', 'unit_cost']);
    const [activeTab, setActiveTab] = useState('sublocations');
    const isLoading = false;
    const [open, setOpen] = useState(isLoading);

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

        router.post('/material-items/location/upload', formData, {
            forceFormData: true,
            onSuccess: () => setSelectedFile(null),
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
        const csvContent = `${csvImportHeaders.join(',')}\n${mappedData.map((row: any) => Object.values(row).join(',')).join('\n')}`;
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

    const tabCounts = {
        sublocations: location.subLocations?.length || 0,
        costCodes: location.cost_codes?.length || 0,
        pricelist: location.material_items?.length || 0,
        fav_materials: location.favourite_materials?.length || 0,
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Location`} />
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight">{location.name}</h1>
                                <p className="text-muted-foreground text-sm">
                                    Location ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{location.eh_location_id}</code>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/location/${location.id}/job-data`} method="get">
                            <Button variant="outline" className="gap-2 transition-all hover:border-primary/50">
                                <RotateCcw className="h-4 w-4" />
                                Load Job Cost
                            </Button>
                        </Link>
                        <Link href={`/location/${location.id}/job-forecast`} method="get">
                            <Button className="gap-2">
                                <ChartColumnIncreasing className="h-4 w-4" />
                                Job Forecast
                            </Button>
                        </Link>
                        <Link href={`/projects/${location.id}/drawings`}>
                            <Button variant="outline" className="gap-2">
                                <FileImage className="h-4 w-4" />
                                Drawings
                            </Button>
                        </Link>
                        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" className="gap-2">
                                    <CirclePlus className="h-4 w-4" />
                                    Create Sub-location
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
                </div>

                {/* Overview Section */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Location Details Card */}
                    <Card className="overflow-hidden">
                        <CardHeader className="border-b bg-muted/30 pb-4">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                Location Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                <div className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/30">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Hash className="h-4 w-4" />
                                        Location ID
                                    </div>
                                    <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{location.eh_location_id}</code>
                                </div>
                                <div className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/30">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <ExternalLink className="h-4 w-4" />
                                        External ID
                                    </div>
                                    {location.external_id ? (
                                        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{location.external_id}</code>
                                    ) : (
                                        <span className="text-sm italic text-muted-foreground">Not set</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/30">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Layers className="h-4 w-4" />
                                        Parent ID
                                    </div>
                                    <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{location.eh_parent_id}</code>
                                </div>
                                <div className="px-6 py-3 transition-colors hover:bg-muted/30">
                                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
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
                                                                <Badge variant="outline" className="cursor-pointer text-xs text-muted-foreground">
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
                                            <span className="text-sm italic text-muted-foreground">No shift conditions configured</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Monthly Spending Chart */}
                    <ChartLineLabel
                        chartData={monthlySpending.map((month) => ({
                            month: month.month,
                            value: Number(month.total),
                        }))}
                    />
                </div>

                {/* Tabs Section */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="h-auto flex-wrap">
                        <TabsTrigger value="sublocations" className="gap-2">
                            <FolderTree className="h-4 w-4" />
                            <span className="hidden sm:inline">Sub-locations</span>
                            <span className="sm:hidden">Subs</span>
                            <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs tabular-nums">
                                {tabCounts.sublocations}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="costCodes" className="gap-2">
                            <Code2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Cost Codes</span>
                            <span className="sm:hidden">Codes</span>
                            <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs tabular-nums">
                                {tabCounts.costCodes}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="pricelist" className="gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="hidden sm:inline">Price List</span>
                            <span className="sm:hidden">Prices</span>
                            <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs tabular-nums">
                                {tabCounts.pricelist}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="fav_materials" className="gap-2">
                            <Heart className="h-4 w-4" />
                            <span className="hidden sm:inline">Favorites</span>
                            <span className="sm:hidden">Favs</span>
                            <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs tabular-nums">
                                {tabCounts.fav_materials}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Sub-locations Tab */}
                    <TabsContent value="sublocations" className="mt-4">
                        <Card className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/30 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <FolderTree className="h-4 w-4 text-muted-foreground" />
                                            Sub-locations
                                        </CardTitle>
                                        <CardDescription>{tabCounts.sublocations} sub-location(s) configured</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="pl-6">ID</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>External ID</TableHead>
                                                <TableHead>Level</TableHead>
                                                <TableHead className="pr-6">Activity</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {location.subLocations.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-32 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
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
                                                    <TableRow key={subLocation.id} className="group transition-colors hover:bg-muted/50">
                                                        <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                                                            {subLocation.eh_location_id}
                                                        </TableCell>
                                                        <TableCell className="font-medium">{subLocation.name}</TableCell>
                                                        <TableCell>
                                                            {subLocation.external_id ? (
                                                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                                    {subLocation.external_id}
                                                                </code>
                                                            ) : (
                                                                <span className="text-sm italic text-muted-foreground">Not set</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                {splitExternalId(subLocation.external_id).level}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="pr-6">
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
                        <Card className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/30 px-6 py-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Code2 className="h-4 w-4 text-muted-foreground" />
                                            Cost Codes
                                        </CardTitle>
                                        <CardDescription>{tabCounts.costCodes} cost code(s) configured</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Link href={`/location/${location.id}/cost-codes/sync`} method="get">
                                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                                                <RefreshCcw className="h-4 w-4" />
                                                Sync from Premier
                                            </Button>
                                        </Link>
                                        <Link href={`/location/${location.id}/cost-codes/edit`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Edit className="h-4 w-4" />
                                                Edit Ratios
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="pl-6">Code</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="w-20 pr-6 text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {location.cost_codes.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="h-32 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
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
                                                    <TableRow key={costCode.id} className="group transition-colors hover:bg-muted/50">
                                                        <TableCell className="pl-6">
                                                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium">
                                                                {costCode.code}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{costCode.description}</TableCell>
                                                        <TableCell className="pr-6 text-right">
                                                            <Link href={`/locations/${location.id}/cost-codes/${costCode.id}/delete`}>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
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
                        <Card className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/30 px-6 py-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            Price List
                                        </CardTitle>
                                        <CardDescription>{tabCounts.pricelist} item(s) in price list</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                                        <a href={`/material-items/location/${location.id}/download-csv`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <FileSpreadsheet className="h-4 w-4" />
                                                CSV
                                            </Button>
                                        </a>
                                        <a href={`/material-items/location/${location.id}/download-excel`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Download className="h-4 w-4" />
                                                Excel
                                            </Button>
                                        </a>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="pl-6">Code</TableHead>
                                                <TableHead>Supplier</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="pr-6 text-right">Unit Cost</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!location.material_items || location.material_items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-32 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                            <Package className="h-8 w-8 opacity-40" />
                                                            <p>No price list available</p>
                                                            <p className="text-xs">Import a CSV to add items</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                location.material_items.map((item) => (
                                                    <TableRow key={item.id} className="group transition-colors hover:bg-muted/50">
                                                        <TableCell className="pl-6">
                                                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium">
                                                                {item.code}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.supplier?.code ? (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {item.supplier.code}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-sm italic text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="max-w-md truncate text-muted-foreground">{item.description}</TableCell>
                                                        <TableCell className="pr-6 text-right">
                                                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                                ${Number(item.pivot?.unit_cost_override ?? 0).toFixed(2)}
                                                            </span>
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
                        <Card className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/30 px-6 py-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Heart className="h-4 w-4 text-muted-foreground" />
                                            Favorite Materials
                                        </CardTitle>
                                        <CardDescription>{tabCounts.fav_materials} favorite material(s)</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <FavouriteMaterialUploader locationId={location.id} />
                                        <a href={`/location/${location.id}/favourite-materials/download-csv`}>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Download className="h-4 w-4" />
                                                Download CSV
                                            </Button>
                                        </a>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="pl-6">Code</TableHead>
                                                <TableHead className="pr-6">Description</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!location.favourite_materials || location.favourite_materials.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={2} className="h-32 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                            <Heart className="h-8 w-8 opacity-40" />
                                                            <p>No favorite materials</p>
                                                            <p className="text-xs">Import a CSV to add favorites</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                location.favourite_materials.map((item) => (
                                                    <TableRow key={item.id} className="group transition-colors hover:bg-muted/50">
                                                        <TableCell className="pl-6">
                                                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium">
                                                                {item.code}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="pr-6 text-muted-foreground">{item.description}</TableCell>
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

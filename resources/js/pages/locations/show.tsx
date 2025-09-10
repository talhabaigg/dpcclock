import CsvImporterDialog from '@/components/csv-importer';
import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CirclePlus, Edit, RefreshCcw, Trash } from 'lucide-react';
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
    // Add other relevant fields as needed
};

// type PaginatedLocations = {
//     id: any;
//     map(arg0: (location: any) => JSX.Element): import('react').ReactNode;
//     data: Location[];
//     current_page: number;
//     last_page: number;
//     per_page: number;
//     total: number;
//     next_page_url: string | null;
//     prev_page_url: string | null;
// };

interface MonthlySpend {
    month: string;
    total: number;
}
export default function LocationsList() {
    const { location, flash, monthlySpending } = usePage<{
        location: Location;
        flash: { success?: string };
        monthlySpending: MonthlySpend[];
    }>().props;
    console.log('Location data:', location);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: 'Edit Location',
            href: `/locations/${location.id}/edit`,
        },
    ];
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [csvImportHeaders] = useState<string[]>(['location_id', 'code', 'unit_cost']);

    // const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
            alert('No file selected for upload');
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
            },
            onError: () => {
                alert('Error creating sub-location');
            },
        });

        formData.reset();
        setOpenDialog(false); // <-- Close the dialog
    };
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);

    const handleCsvSubmit = (mappedData: any) => {
        // Create CSV content from mapped data
        alert('Mapped Data: ' + JSON.stringify(mappedData));
        // Define headers in state and use them for CSV
        const csvContent = `${csvImportHeaders.join(',')}\n${mappedData.map((row: any) => Object.values(row).join(',')).join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });
        setSelectedFile(file);
        setShouldUploadAfterSet(true);
    };
    useEffect(() => {
        if (selectedFile && shouldUploadAfterSet) {
            handleUpload(location.id);
            setShouldUploadAfterSet(false); // reset the flag
        }
    }, [selectedFile, shouldUploadAfterSet]);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);
    const isLoading = false;
    const [open, setOpen] = useState(isLoading);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />
            <LoadingDialog open={open} setOpen={setOpen} />
            <div className="m-2 flex items-center gap-2">
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogTrigger asChild>
                        <Button variant="secondary" className="mx-auto w-full max-w-96 sm:mx-0 sm:w-full sm:max-w-48">
                            <CirclePlus />
                            Create sub-location
                        </Button>
                    </DialogTrigger>

                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create sub-location for {location.name}</DialogTitle>
                            <DialogDescription>
                                This action cannot be undone. This will create a new sub-location in Employment Hero for the location selected.{' '}
                                <br></br>Please follow the naming convention of other codes.
                            </DialogDescription>
                            <div className="flex flex-col gap-2">
                                <Label>Level</Label>
                                <Input value={formData.data.level ?? ''} onChange={(e) => formData.setData('level', e.target.value)} />
                                <Label>Activity</Label>
                                <Input value={formData.data.activity ?? ''} onChange={(e) => formData.setData('activity', e.target.value)}></Input>

                                <Button onClick={handleFormSubmit}>Create</Button>
                            </div>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
                {/* {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}{' '} */}
            </div>
            <div className="mx-auto flex max-w-96 flex-col space-y-1 sm:m-0 sm:max-w-full sm:flex-row">
                <Card className="w-full p-0 sm:m-2 md:w-1/2 2xl:w-1/3">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableHead>Location ID</TableHead>
                                <TableCell className="w-[100px]">{location.eh_location_id}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead>External ID</TableHead>
                                <TableCell className="w-[100px]">{location.external_id}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableCell className="w-[100px]">{location.name}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead>Shift Conditionss</TableHead>
                                <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                        {location.worktypes?.length > 0 ? (
                                            <>
                                                {location.worktypes.slice(0, 1).map((worktype) => (
                                                    <Badge key={worktype.eh_worktype_id}>{worktype.name}</Badge>
                                                ))}

                                                {location.worktypes.length > 1 && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="outline" className="text-muted-foreground cursor-pointer">
                                                                    +{location.worktypes.length - 1} more
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-sm p-2">
                                                                <div className="flex max-w-sm flex-wrap gap-1">
                                                                    {location.worktypes.slice(1).map((worktype) => (
                                                                        <Badge key={worktype.eh_worktype_id} variant="secondary">
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
                                            'No default shift conditions'
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableHead>Parent EH Location Id</TableHead>
                                <TableCell>{location.eh_parent_id}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Card>
                <div className="w-full sm:m-2">
                    <ChartLineLabel
                        chartData={monthlySpending.map((month) => ({
                            month: month.month,
                            value: Number(month.total),
                        }))}
                    />
                </div>
            </div>
            <Tabs defaultValue="sublocations" className="mr-2">
                <TabsList className="mx-auto mt-2 grid h-24 max-w-96 grid-cols-2 sm:m-0 sm:ml-2 sm:h-12 sm:max-w-full sm:grid-cols-4">
                    <TabsTrigger value="sublocations">
                        <span className="mr-2 rounded-sm border p-0.5 text-xs text-[0.625rem] dark:text-gray-400">SL</span>Sub-locations
                    </TabsTrigger>
                    <TabsTrigger value="costCodes">
                        <span className="mr-2 rounded-sm border p-0.5 text-xs text-[0.625rem] dark:text-gray-400">CC</span>Cost Codes
                    </TabsTrigger>
                    <TabsTrigger value="pricelist">
                        <span className="mr-2 rounded-sm border p-0.5 text-xs text-[0.625rem] dark:text-gray-400">PL</span>Price List
                    </TabsTrigger>
                    <TabsTrigger value="fav_materials">
                        <span className="mr-2 rounded-sm border p-0.5 text-xs text-[0.625rem] dark:text-gray-400">MAT</span>Favorite Materials
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="sublocations">
                    <Card className="mx-auto w-full max-w-96 p-0 sm:m-2 sm:max-w-full">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sub Location ID</TableHead>
                                    <TableHead>Sub Location Name</TableHead>
                                    <TableHead>Sub Location External ID</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Acitivity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {location.subLocations.map((subLocation) => (
                                    <TableRow key={subLocation.id}>
                                        <TableCell>{subLocation.eh_location_id}</TableCell>
                                        <TableCell>{subLocation.name}</TableCell>
                                        <TableCell>{subLocation.external_id || 'Not Set'}</TableCell>
                                        <TableCell>{splitExternalId(subLocation.external_id).level}</TableCell>
                                        <TableCell>{splitExternalId(subLocation.external_id).activity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                <TabsContent value="costCodes" className="mx-auto w-full max-w-96 sm:m-2 sm:max-w-full">
                    <div className="flex flex-col justify-between gap-2 sm:m-2 sm:flex-row">
                        <Link href={`/location/${location.id}/cost-codes/sync`} method="get">
                            <Button variant="secondary" onClick={() => setOpen(true)}>
                                <RefreshCcw /> Sync from Premier
                            </Button>
                        </Link>
                        <Link href={`/location/${location.id}/cost-codes/edit`}>
                            <Button variant="secondary" className="mx-2">
                                <Edit /> Edit Variation Ratios
                            </Button>
                        </Link>
                    </div>

                    <Card className="mx-2 mt-2 mb-2 max-w-sm rounded-md border p-0 sm:max-w-full">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cost Code</TableHead>
                                    <TableHead>Cost Description</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {location.cost_codes.length > 0 ? (
                                    location.cost_codes.map((costCode) => (
                                        <TableRow key={costCode.id}>
                                            <TableCell>{costCode.code}</TableCell>
                                            <TableCell>{costCode.description}</TableCell>
                                            <TableCell>
                                                <Link href={`/locations/${location.id}/cost-codes/${costCode.id}/delete`}>
                                                    <Button size="sm" variant="ghost">
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center">
                                            No cost codes available for this job.
                                        </TableCell>
                                    </TableRow>
                                )}
                                <TableRow></TableRow>
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                <TabsContent value="pricelist" className="mx-auto w-full max-w-96 sm:m-2 sm:max-w-full">
                    <div className="flex flex-col justify-end gap-2 sm:m-2 sm:flex-row">
                        {/* <Input type="file" accept=".csv" onChange={handleFileChange} />
                        <Button onClick={() => handleUpload(location.id)} disabled={!selectedFile || processing}>
                            Upload CSV
                        </Button> */}
                        <CsvImporterDialog requiredColumns={csvImportHeaders} onSubmit={handleCsvSubmit} />
                        <a href={`/material-items/location/${location.id}/download-csv`}>
                            <Button className="w-32">Download CSV</Button>
                        </a>
                    </div>

                    <Card className="mt-2 p-0 sm:m-2">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow className="rounded-t-md">
                                    <TableHead>Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Unit Cost</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {!location.material_items || location.material_items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center">
                                            No price list available for this job.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    location.material_items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.code}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell>${item.pivot?.unit_cost_override}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                <TabsContent value="fav_materials" className="mx-auto w-full max-w-96 sm:m-2 sm:max-w-full">
                    <div className="flex flex-col justify-end gap-2 sm:m-2 sm:flex-row">
                        <FavouriteMaterialUploader locationId={location.id} />

                        <a href={`/location/${location.id}/favourite-materials/download-csv`}>
                            <Button className="w-32">Download CSV</Button>
                        </a>
                    </div>
                    <Card className="mt-2 p-0 sm:m-2">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow className="rounded-t-md">
                                    <TableHead>Code</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {!location.favourite_materials || location.favourite_materials.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center">
                                            No favourite materials available for this location.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    location.favourite_materials.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.code}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}

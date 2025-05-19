import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { JSX } from 'react/jsx-runtime';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Locations',
        href: '/locations',
    },
];

type Location = {
    id: number;
    name: string;
    eh_location_id: string;
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
};

type PaginatedLocations = {
    map(arg0: (location: any) => JSX.Element): import('react').ReactNode;
    data: Location[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
};
export default function LocationsList() {
    const { location, flash } = usePage<{ location: PaginatedLocations; flash: { success?: string } }>().props;
    console.log('location', location);
    let isLoading = false;
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);

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

    const formData = useForm({
        level: null,
        activity: null,
        location_id: location.id,
    });

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        console.log('formData', formData.data);

        router.post('/sub-locations', formData.data, {
            onSuccess: () => {
                formData.reset();
                setProcessing(false);
            },
            onError: () => {
                setProcessing(false);
                console.log('Error creating sub-location');
            },
        });

        formData.reset();
        setOpenDialog(false); // <-- Close the dialog
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Locations" />
            <div className="m-2 flex items-center gap-2">
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogTrigger asChild>
                        <Button variant="secondary">Create sub-location</Button>
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
                {flash.success && <div className="m-2 text-green-500">{flash.success}</div>}{' '}
            </div>

            <Card className="m-2 w-full p-0 md:w-1/2 2xl:w-1/3">
                <Table>
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
                        <TableHead>Sub Locations</TableHead>
                        <TableCell className="w-[100px]">
                            {location.worktypes.map((worktype) => (
                                <div key={worktype.id} className="flex items-center gap-2">
                                    <span className="flex-wrap">{worktype.name}</span>
                                </div>
                            ))}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHead>Parent EH Location Id</TableHead>
                        <TableCell>{location.eh_parent_id}</TableCell>
                    </TableRow>
                </Table>
            </Card>

            <Card className="m-2 w-full p-0">
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
        </AppLayout>
    );
}

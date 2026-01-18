import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { Eye, FileImage, PlusCircle, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'QA Stages',
        href: '/qa-stages',
    },
];

type Location = {
    id: number;
    name: string;
};

type QaStage = {
    id: number;
    name: string;
    location_id: number;
    location: Location;
    created_by: number;
    created_by_user?: { name: string };
    drawings: Array<{ id: number }>;
    created_at: string;
};

export default function QaStagesIndex() {
    const { qaStages, locations, flash } = usePage<{
        qaStages: QaStage[];
        locations: Location[];
        flash: { success?: string; error?: string };
    }>().props;

    const [open, setOpen] = useState(false);
    const [locationId, setLocationId] = useState<string>('');
    const [stageName, setStageName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash.success, flash.error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!locationId || !stageName) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsSubmitting(true);
        router.post(
            '/qa-stages',
            {
                location_id: locationId,
                name: stageName,
            },
            {
                onSuccess: () => {
                    setOpen(false);
                    setLocationId('');
                    setStageName('');
                    setIsSubmitting(false);
                },
                onError: () => {
                    setIsSubmitting(false);
                },
            },
        );
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this QA stage?')) {
            router.delete(`/qa-stages/${id}`);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="QA Stages" />
            <div className="m-2 flex items-center gap-2">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create QA Stage
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create QA Stage</DialogTitle>
                            <DialogDescription>Create a new quality assurance stage for a location.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="location">Location</Label>
                                    <Select value={locationId} onValueChange={(value) => setLocationId(value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locations.map((location) => (
                                                <SelectItem key={location.id} value={String(location.id)}>
                                                    {location.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Stage Name</Label>
                                    <Input
                                        id="name"
                                        value={stageName}
                                        onChange={(e) => setStageName(e.target.value)}
                                        placeholder="e.g. Level 10, Ground Floor, Roof"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Creating...' : 'Create Stage'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="mx-2 p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Stage Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Drawings</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {qaStages.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground text-center">
                                    No QA stages found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            qaStages.map((stage) => (
                                <TableRow key={stage.id}>
                                    <TableCell>{stage.id}</TableCell>
                                    <TableCell className="font-medium">{stage.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{stage.location?.name}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <FileImage className="h-4 w-4" />
                                            <span>{stage.drawings?.length || 0}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{format(new Date(stage.created_at), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Link href={`/qa-stages/${stage.id}`}>
                                                <Button size="sm" variant="outline">
                                                    <Eye className="mr-1 h-4 w-4" />
                                                    View
                                                </Button>
                                            </Link>
                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(stage.id)}>
                                                <Trash className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </AppLayout>
    );
}

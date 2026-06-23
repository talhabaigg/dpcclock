import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

interface Location {
    id: number;
    name: string;
}

interface SwmsResource {
    id: string;
    name: string;
    description: string | null;
}

interface Props {
    swms: SwmsResource | null;
    location: Location;
}

export default function SwmsForm({ swms, location }: Props) {
    const isEdit = !!swms;
    const baseUrl = `/locations/${location.id}/swms`;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'SWMS', href: baseUrl },
        { title: isEdit ? 'Edit' : 'New', href: '#' },
    ];

    const form = useForm({
        name: swms?.name ?? '',
        description: swms?.description ?? '',
    });

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit && swms) {
            form.put(`${baseUrl}/${swms.id}`);
        } else {
            form.post(baseUrl);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? 'Edit SWMS' : 'New SWMS'} />
            <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
                <form onSubmit={onSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>{isEdit ? 'Edit SWMS' : `New SWMS — ${location.name}`}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="e.g. Demolition – Level 1 slab"
                                />
                                {form.errors.name && <p className="text-destructive mt-1 text-xs">{form.errors.name}</p>}
                            </div>

                            <div>
                                <Label htmlFor="description">Description (optional)</Label>
                                <Textarea
                                    id="description"
                                    value={form.data.description ?? ''}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                    rows={4}
                                />
                                {form.errors.description && <p className="text-destructive mt-1 text-xs">{form.errors.description}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-4 flex justify-end gap-2">
                        <Button asChild variant="outline" type="button">
                            <Link href={isEdit && swms ? `${baseUrl}/${swms.id}` : baseUrl}>Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {isEdit ? 'Save changes' : 'Create SWMS'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

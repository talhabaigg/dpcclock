import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Variations',
        href: '/variations',
    },
];

interface Location {
    id: number;
    name: string;
}

const VariationCreate = ({ locations }: { locations: Location[] }) => {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="m-2 flex items-center justify-between gap-2">
                <Card className="min-w-full">
                    <CardHeader className="font-bold">Create New Variation</CardHeader>
                    <CardDescription className="ml-6">This page allows you to generate a variation for Premier.</CardDescription>
                    <CardContent className="flex flex-col gap-4 px-6 sm:flex-row">
                        <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                            <Select>
                                <SelectTrigger className="flex-1">Select job</SelectTrigger>
                                <SelectContent>
                                    {locations.map((location) => (
                                        <SelectItem key={location.id} value={String(location.id)}>
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select>
                                <SelectTrigger className="flex-1">Select type</SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dayworks">Dayworks</SelectItem>
                                    <SelectItem value="variations">Variations</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
};

export default VariationCreate;
